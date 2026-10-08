import { NextRequest, NextResponse } from 'next/server';
import { prisma, isPostgresAvailable } from '@/server/lib/prisma';
import { localStore } from '@/server/lib/store';

function parseCustomerSession(req: NextRequest): { customerId?: string; phone?: string; tenantId?: string } | null {
  const cookieToken = req.cookies.get('autoledger_customer_token')?.value;
  const authHeader = req.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
  const rawToken = cookieToken || bearerToken || req.headers.get('x-customer-token');

  if (rawToken) {
    try {
      return JSON.parse(Buffer.from(rawToken, 'base64').toString('utf-8'));
    } catch {
      // Fallback
    }
  }

  const phone = req.headers.get('x-customer-phone');
  if (phone) {
    return { phone: phone.replace(/[^0-9]/g, '').slice(-10) };
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const session = parseCustomerSession(req);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in with your phone number.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { items, notes } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Order must contain at least one spare part item.' },
        { status: 400 }
      );
    }

    let customer: any = null;
    let tenant: any = null;
    const hasDb = await isPostgresAvailable();

    if (hasDb) {
      try {
        if (session.customerId) {
          customer = await prisma.customer.findUnique({
            where: { id: session.customerId },
            include: { tenant: true },
          });
        } else if (session.phone) {
          customer = await prisma.customer.findFirst({
            where: { phone: { contains: session.phone } },
            include: { tenant: true },
          });
        }
        if (customer) tenant = customer.tenant;
      } catch (err) {
        console.warn('Postgres customer fetch failed for order creation:', err);
      }
    }

    if (!customer) {
      if (session.customerId) {
        customer = localStore.getCustomerById(session.customerId);
      } else if (session.phone) {
        customer = localStore.getCustomerByPhone(session.phone);
      }
      if (customer) {
        tenant = localStore.getTenant(customer.tenantId);
      }
    }

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer account not found.' },
        { status: 404 }
      );
    }

    // Calculate total order value
    let grandTotalPaise = 0n;
    const lineItems: any[] = [];

    for (const item of items) {
      const unitPricePaise = BigInt(item.salePricePaise || '0');
      const qty = BigInt(item.quantity || 1);
      const totalPaise = unitPricePaise * qty;
      grandTotalPaise += totalPaise;

      lineItems.push({
        id: item.id || `item-${Date.now()}`,
        productId: item.productId || item.id,
        name: item.name || 'Spare Part',
        partNumber: item.partNumber || 'GEN-PART',
        quantity: Number(qty),
        unitPricePaise: unitPricePaise.toString(),
        totalPaise: totalPaise.toString(),
        hsnCode: item.hsnCode || '87141090',
        gstRateBp: item.gstRateBp || 1800,
      });
    }

    const orderRef = `ORD-${Date.now().toString().slice(-6)}`;
    const invoiceNumber = `REQ/${new Date().getFullYear()}/${orderRef}`;

    // Create Draft Invoice / Order Requisition
    let orderRecord: any = null;

    if (hasDb && customer.id) {
      try {
        orderRecord = await prisma.invoice.create({
          data: {
            tenantId: customer.tenantId,
            customerId: customer.id,
            invoiceNumber,
            type: 'TAX_INVOICE',
            status: 'DRAFT',
            date: new Date(),
            placeOfSupply: '27',
            isReverseCharge: false,
            subtotalPaise: grandTotalPaise,
            discountPaise: 0n,
            taxablePaise: grandTotalPaise,
            cgstPaise: 0n,
            sgstPaise: 0n,
            igstPaise: 0n,
            grandTotalPaise,
            roundOffPaise: 0n,
            paidNowPaise: 0n,
            creditBalancePaise: grandTotalPaise,
            items: {
              create: lineItems.map((li) => ({
                productId: li.productId,
                quantity: li.quantity,
                unitPricePaise: BigInt(li.unitPricePaise),
                discountPaise: 0n,
                taxablePaise: BigInt(li.totalPaise),
                cgstPaise: 0n,
                sgstPaise: 0n,
                igstPaise: 0n,
                totalPaise: BigInt(li.totalPaise),
                hsnCode: li.hsnCode,
                gstRateBp: li.gstRateBp,
              })),
            },
          },
          include: { items: true },
        });
      } catch (dbErr) {
        console.warn('Postgres order creation failed, falling back to localStore:', dbErr);
      }
    }

    if (!orderRecord) {
      orderRecord = localStore.createInvoice({
        tenantId: customer.tenantId || tenant?.id || 'tenant-honda-1',
        customerId: customer.id,
        invoiceNumber,
        grandTotalPaise: grandTotalPaise.toString(),
        paidNowPaise: '0',
        creditBalancePaise: grandTotalPaise.toString(),
        items: lineItems,
      });
    }

    // Generate WhatsApp Order Summary string for 1-click sharing with dealership
    const totalRupees = (Number(grandTotalPaise) / 100).toFixed(2);
    const itemListSummary = lineItems
      .map((li, idx) => `${idx + 1}. ${li.name} (${li.partNumber}) x ${li.quantity} = ₹${(Number(li.totalPaise) / 100).toFixed(2)}`)
      .join('\n');

    const waOrderMessage = encodeURIComponent(
      `*New Spares Requisition / Order on Khata*\n` +
      `--------------------------------\n` +
      `*Order Ref:* ${invoiceNumber}\n` +
      `*Workshop:* ${customer.shopName} (${customer.name})\n` +
      `*Phone:* +91 ${customer.phone}\n` +
      `*Supplier:* ${tenant?.name || 'Apex Trade & Wholesale'}\n\n` +
      `*Items Requested:*\n${itemListSummary}\n\n` +
      `*Total Order Value:* ₹${totalRupees}\n` +
      `*Payment Terms:* Khata Credit Requisition\n` +
      `*Notes:* ${notes || 'Ready for packing & dispatch'}\n` +
      `--------------------------------\n` +
      `_Generated via TradeLedger Client Portal_`
    );

    return NextResponse.json({
      success: true,
      message: 'Requisition placed successfully on Khata! Counter staff notified.',
      order: {
        id: orderRecord.id,
        invoiceNumber,
        grandTotalPaise: grandTotalPaise.toString(),
        totalRupees,
        itemCount: lineItems.length,
        items: lineItems,
        createdAt: new Date().toISOString(),
        waShareUrl: `https://wa.me/${(tenant?.phone || '').replace(/[^0-9]/g, '')}?text=${waOrderMessage}`,
      },
    });
  } catch (error: any) {
    console.error('Error placing portal order:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to place spare parts order.' },
      { status: 500 }
    );
  }
}
