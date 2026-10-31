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
    if (!authUser || !authUser.tenantId) {
      return NextResponse.json({ error: 'Unauthorized: Authentication and tenant context required' }, { status: 401 });
    }
    const targetTenantId = authUser.tenantId;

    const body = await req.json();
    const { entries = [] } = body;

    if (!Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ error: 'At least one customer balance entry is required' }, { status: 400 });
    }

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

      let activeCustId = customerId;

      // If customerId supplied, verify it belongs to this tenant
      if (activeCustId) {
        if (hasDb && isUuid(activeCustId) && isUuid(targetTenantId)) {
          const dbCust = await prisma.customer.findFirst({
            where: { id: activeCustId, tenantId: targetTenantId },
            select: { id: true },
          });
          if (!dbCust) {
            // Customer does not belong to this tenant, skip to prevent cross-tenant corruption
            continue;
          }
        } else {
          const localCust = localStore.getCustomerById(activeCustId, targetTenantId);
          if (!localCust) {
            continue;
          }
        }
      }

      // 1. If customer doesn't exist, create within this tenant
      if (!activeCustId && phone && (shopName || name)) {
        // Find existing or create scoped to targetTenantId
        const existingLocal = localStore.getCustomerByPhone(phone, targetTenantId);
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

      if (isDue) {
        totalMigratedDebitPaise += amt;
      } else {
        totalMigratedCreditPaise += amt;
      }

      // Persist in Prisma if available
      if (hasDb && isUuid(activeCustId) && isUuid(targetTenantId)) {
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
