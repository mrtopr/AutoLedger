import { NextRequest, NextResponse } from 'next/server';
import { prisma, isPostgresAvailable } from '@/server/lib/prisma';
import { getAuthenticatedUser } from '@/server/lib/auth';
import { localStore } from '@/server/lib/store';
import { CreditStatus, CustomerType, LedgerEntryType } from '@prisma/client';

const isUuid = (id?: string | null): boolean =>
  typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    const body = await req.json();
    const { entries = [] } = body;

    if (!Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ error: 'At least one customer balance entry is required' }, { status: 400 });
    }

    const targetTenantId = authUser?.tenantId || localStore.getTenants()[0]?.id || 'tenant-apex-1';
    const hasDb = await isPostgresAvailable();

    const processedResults = [];
    let totalMigratedDebitPaise = 0n;
    let totalMigratedCreditPaise = 0n;

    for (const item of entries) {
      const {
        customerId,
        shopName,
        name,
        phone,
        address,
        amountPaise,
        type = 'DUE', // 'DUE' (Dr) or 'ADVANCE' (Cr)
        date,
        narration,
      } = item;

      if (!amountPaise || BigInt(amountPaise) <= 0n) {
        continue;
      }

      const amt = BigInt(amountPaise);
      const isDue = type === 'DUE' || type === 'DEBIT';
      const entryDate = date ? new Date(date) : new Date();
      const defaultNote = narration || (isDue ? 'Previous Register Udhar Migration' : 'Opening Advance Deposit');

      if (isDue) {
        totalMigratedDebitPaise += amt;
      } else {
        totalMigratedCreditPaise += amt;
      }

      let activeCustId = customerId;

      // 1. If customer exists, append ledger entry. If new, create customer first.
      if (!activeCustId && phone && (shopName || name)) {
        // Find existing or create
        const existingLocal = localStore.getCustomerByPhone(phone);
        if (existingLocal) {
          activeCustId = existingLocal.id;
        } else {
          // Create in DB
          if (hasDb && isUuid(targetTenantId)) {
            try {
              const created = await prisma.customer.create({
                data: {
                  tenantId: targetTenantId,
                  shopName: shopName || name,
                  name: name || shopName,
                  phone,
                  address: address || null,
                  creditLimit: 5000000n,
                  customerType: CustomerType.RETAILER,
                  status: CreditStatus.GREEN,
                  isActive: true,
                }
              });
              activeCustId = created.id;
            } catch (e) {
              console.warn('Prisma customer creation in bulk fallback:', e);
            }
          }

          // Create in localStore
          const localCreated = localStore.createCustomer({
            tenantId: targetTenantId,
            shopName: shopName || name,
            name: name || shopName,
            phone,
            address: address || 'Main Market',
            gstin: null,
            customerType: 'RETAILER',
            balancePaise: '0',
            creditLimitPaise: '5000000',
            status: 'GREEN',
            termsDays: 15,
            overduePaise: '0',
          });
          if (!activeCustId) activeCustId = localCreated.id;
        }
      }

      if (!activeCustId) continue;

      // Persist in Prisma if available
      if (hasDb && isUuid(activeCustId)) {
        try {
          await prisma.ledgerEntry.create({
            data: {
              tenantId: targetTenantId,
              customerId: activeCustId,
              entryType: isDue ? LedgerEntryType.ADJUSTMENT : LedgerEntryType.PAYMENT,
              debit: isDue ? amt : 0n,
              credit: isDue ? 0n : amt,
              entryDate,
              narration: defaultNote,
            }
          });
        } catch (e) {
          console.warn('Prisma bulk ledger entry fallback:', e);
        }
      }

      // Persist in localStore
      localStore.addLedgerEntry({
        tenantId: targetTenantId,
        customerId: activeCustId,
        date: entryDate.toISOString().split('T')[0],
        type: isDue ? 'OPENING_DUE' : 'OPENING_ADVANCE',
        refNo: 'BATCH-OPENING',
        narration: defaultNote,
        debitPaise: isDue ? amt.toString() : '0',
        creditPaise: isDue ? '0' : amt.toString(),
      });

      processedResults.push({
        customerId: activeCustId,
        amountPaise: amt.toString(),
        type,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully recorded opening balances for ${processedResults.length} accounts.`,
      count: processedResults.length,
      totalDebitPaise: totalMigratedDebitPaise.toString(),
      totalCreditPaise: totalMigratedCreditPaise.toString(),
      results: processedResults,
    }, { status: 200 });
  } catch (error: any) {
    console.error('Error processing bulk opening balances:', error);
    return NextResponse.json({ error: error.message || 'Failed to process bulk opening balances' }, { status: 500 });
  }
}
