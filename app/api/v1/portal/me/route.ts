import { NextRequest, NextResponse } from 'next/server';
import { prisma, isPostgresAvailable } from '@/server/lib/prisma';
import { localStore } from '@/server/lib/store';

function parseCustomerSession(req: NextRequest): { customerId?: string; phone?: string; tenantId?: string } | null {
  // 1. Try Cookie
  const cookieToken = req.cookies.get('autoledger_customer_token')?.value;
  // 2. Try Authorization header
  const authHeader = req.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
  // 3. Try custom header
  const rawToken = cookieToken || bearerToken || req.headers.get('x-customer-token');

  if (rawToken) {
    try {
      const decoded = JSON.parse(Buffer.from(rawToken, 'base64').toString('utf-8'));
      return decoded;
    } catch {
      // Fallback if not base64 JSON
    }
  }

  // 4. Fallback to phone header if provided directly in client dev mode
  const phone = req.headers.get('x-customer-phone');
  if (phone) {
    return { phone: phone.replace(/[^0-9]/g, '').slice(-10) };
  }

  return null;
}

export async function GET(req: NextRequest) {
  try {
    const session = parseCustomerSession(req);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in with your phone number.' },
        { status: 401 }
      );
    }

    let customer: any = null;
    let tenant: any = null;
    let invoices: any[] = [];
    let ledger: any[] = [];

    const hasDb = await isPostgresAvailable();
    if (hasDb) {
      try {
        if (session.customerId) {
          customer = await prisma.customer.findUnique({
            where: { id: session.customerId },
            include: {
              tenant: true,
              invoices: {
                orderBy: { createdAt: 'desc' },
                take: 50,
                include: { items: true },
              },
              ledgerEntries: {
                orderBy: { createdAt: 'desc' },
                take: 100,
              },
            },
          });
        } else if (session.phone) {
          customer = await prisma.customer.findFirst({
            where: { phone: { contains: session.phone } },
            include: {
              tenant: true,
              invoices: {
                orderBy: { createdAt: 'desc' },
                take: 50,
                include: { items: true },
              },
              ledgerEntries: {
                orderBy: { createdAt: 'desc' },
                take: 100,
              },
            },
          });
        }

        if (customer) {
          tenant = customer.tenant;

          // Process invoices
          invoices = (customer.invoices || []).map((inv: any) => ({
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            date: inv.invoiceDate ? new Date(inv.invoiceDate).toISOString().split('T')[0] : inv.createdAt.toISOString().split('T')[0],
            grandTotalPaise: inv.grandTotalPaise || (inv.grandTotal !== undefined ? inv.grandTotal.toString() : '0'),
            paidNowPaise: inv.paidNowPaise || (inv.paidAmount !== undefined ? inv.paidAmount.toString() : '0'),
            creditBalancePaise: inv.creditBalancePaise || '0',
            status: inv.status,
            itemCount: inv.items?.length || 0,
            items: (inv.items || []).map((it: any) => ({
              id: it.id,
              name: it.name || it.productName || 'Spare Part',
              partNumber: it.partNumber || '-',
              qty: it.qty || it.quantity || 1,
              ratePaise: it.ratePaise || (it.unitPrice !== undefined ? it.unitPrice.toString() : '0'),
              totalPaise: it.lineTotalPaise || (it.total !== undefined ? it.total.toString() : '0'),
              gstRateBp: it.gstRateBp || 1800,
            })),
          }));

          // Process chronological ledger
          const ledgerChronological = [...(customer.ledgerEntries || [])].reverse();
          let currentBalance = 0n;
          ledger = ledgerChronological.map((entry: any) => {
            const d = entry.debit !== undefined ? BigInt(entry.debit) : BigInt(entry.debitPaise || 0);
            const c = entry.credit !== undefined ? BigInt(entry.credit) : BigInt(entry.creditPaise || 0);
            currentBalance = currentBalance + d - c;
            return {
              id: entry.id,
              date: entry.entryDate ? new Date(entry.entryDate).toISOString().split('T')[0] : entry.createdAt.toISOString().split('T')[0],
              type: entry.entryType,
              refNo: entry.refId || entry.refNumber || '-',
              narration: entry.narration,
              debitPaise: d.toString(),
              creditPaise: c.toString(),
              runningBalancePaise: currentBalance.toString(),
            };
          }).reverse();
        }
      } catch (dbErr) {
        console.warn('Postgres customer me lookup failed, falling back to localStore:', dbErr);
      }
    }

    // LocalStore fallback
    if (!customer) {
      if (session.customerId) {
        customer = localStore.getCustomerById(session.customerId);
      } else if (session.phone) {
        customer = localStore.getCustomerByPhone(session.phone);
      }

      if (customer) {
        tenant = localStore.getTenant(customer.tenantId);
        ledger = localStore.getLedger(customer.id);
        const allInvoices = localStore.getInvoices();
        invoices = allInvoices
          .filter((inv) => inv.customerId === customer.id)
          .map((inv) => ({
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            date: inv.createdAt.split('T')[0],
            grandTotalPaise: inv.grandTotalPaise || '0',
            paidNowPaise: inv.paidNowPaise || '0',
            creditBalancePaise: inv.creditBalancePaise || '0',
            status: 'COMPLETED',
            itemCount: inv.items?.length || 0,
            items: inv.items || [],
          }));
      }
    }

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer record not found. Please log in again.' },
        { status: 404 }
      );
    }

    const finalBalancePaise = ledger.length > 0 ? ledger[0].runningBalancePaise : (customer.balancePaise || '0');

    return NextResponse.json({
      success: true,
      customer: {
        id: customer.id,
        name: customer.name,
        shopName: customer.shopName || customer.name,
        phone: customer.phone,
        address: customer.address,
        gstin: customer.gstin,
        customerType: customer.customerType || 'GARAGE',
        balancePaise: finalBalancePaise,
        creditLimitPaise: customer.creditLimitPaise || customer.creditLimit?.toString() || '5000000',
        termsDays: customer.termsDays || customer.paymentTermsDays || 15,
        status: customer.status || 'GREEN',
      },
      dealership: {
        id: tenant?.id || 'tenant-honda-1',
        name: tenant?.name || 'AutoLedger Dealership',
        legalName: tenant?.legalName || tenant?.name || 'AutoLedger Dealership',
        phone: tenant?.phone || '+91 98221 00001',
        address: tenant?.address || 'Main Auto Spares Market',
        gstin: tenant?.gstin,
        upiId: tenant?.upiId || 'royalauto@okhdfcbank',
        bankName: tenant?.bankDetails?.bankName || 'HDFC Bank',
        accountNumber: tenant?.bankDetails?.accountNumber || '50200012345678',
        ifscCode: tenant?.bankDetails?.ifscCode || 'HDFC0001234',
      },
      invoices,
      ledger,
    });
  } catch (error: any) {
    console.error('Error fetching portal profile:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load customer portal profile.' },
      { status: 500 }
    );
  }
}
