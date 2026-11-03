import { NextRequest, NextResponse } from 'next/server';
import { prisma, isPostgresAvailable } from '@/server/lib/prisma';
import { signToken, hashPassword, TOKEN_COOKIE_NAME } from '@/server/lib/auth';
import { localStore } from '@/server/lib/store';
import { Role, CustomerType, CreditStatus, InvoiceStatus, InvoiceType, StockReason, LedgerEntryType } from '@prisma/client';

export const dynamic = 'force-dynamic';

const DEMO_EMAIL = 'demo@autoledger.app';
const DEMO_PHONE = '9822012345';
const DEMO_PASS = 'Demo@123';
const DEMO_TENANT_NAME = 'AutoLedger Demo Motors';

export async function POST(req: NextRequest) {
  try {
    const hasDb = await isPostgresAvailable();
    let tenantId: string | null = null;
    let userId: string | null = null;
    let userName = 'Rajesh Sharma (Owner)';
    let tenantName = DEMO_TENANT_NAME;

    const hashedPassword = await hashPassword(DEMO_PASS);

    // =========================================================================
    // 1. POSTGRES PROVISIONING / RETRIEVAL
    // =========================================================================
    if (hasDb) {
      try {
        let dbTenant = await prisma.tenant.findFirst({
          where: { name: DEMO_TENANT_NAME },
        });

        if (!dbTenant) {
          dbTenant = await prisma.tenant.create({
            data: {
              name: DEMO_TENANT_NAME,
              legalName: 'AutoLedger Demo Motors LLP',
              gstin: '27AABCA1234F1Z9',
              address: 'Shop No. 12-14, Pune Auto Spare Market, Nana Peth, Pune - 411002',
              stateCode: '27',
              upiId: 'autoledger.demo@icici',
              bankDetails: {
                bankName: 'HDFC Bank',
                accountName: 'AutoLedger Demo Motors',
                accountNumber: '50200012345678',
                ifscCode: 'HDFC0001234',
                branch: 'Camp Pune',
              },
            },
          });
        }
        tenantId = dbTenant.id;
        tenantName = dbTenant.name;

        let dbUser = await prisma.user.findFirst({
          where: { tenantId: dbTenant.id, email: DEMO_EMAIL },
        });

        if (!dbUser) {
          dbUser = await prisma.user.create({
            data: {
              tenantId: dbTenant.id,
              name: 'Rajesh Sharma (Owner)',
              email: DEMO_EMAIL,
              phone: DEMO_PHONE,
              password: hashedPassword,
              role: Role.OWNER,
            },
          });
        } else if (!dbUser.password) {
          await prisma.user.update({
            where: { id: dbUser.id },
            data: { password: hashedPassword },
          });
        }
        userId = dbUser.id;
        userName = dbUser.name;

        // Ensure 3 Customers Exist
        const existingCustCount = await prisma.customer.count({ where: { tenantId: dbTenant.id } });
        if (existingCustCount < 3) {
          const c1 = await prisma.customer.create({
            data: {
              tenantId: dbTenant.id,
              name: 'Suresh Patil',
              shopName: 'Speed Motors Workshop',
              phone: '9822110001',
              address: 'Near Swargate Bus Stand, Pune',
              customerType: CustomerType.GARAGE,
              creditLimit: 5000000n, // ₹50,000
              paymentTermsDays: 15,
              status: CreditStatus.GREEN,
              isActive: true,
            },
          });
          const c2 = await prisma.customer.create({
            data: {
              tenantId: dbTenant.id,
              name: 'Ramesh Sharma',
              shopName: 'Sharma Auto Care & Service',
              phone: '9822110002',
              address: 'Hadapsar Bypass Road, Pune',
              customerType: CustomerType.GARAGE,
              creditLimit: 2500000n, // ₹25,000
              paymentTermsDays: 7,
              status: CreditStatus.YELLOW,
              isActive: true,
            },
          });
          await prisma.customer.create({
            data: {
              tenantId: dbTenant.id,
              name: 'Ajay Kulkarni',
              shopName: 'National Bike Point',
              phone: '9822110003',
              address: 'Kothrud Paud Road, Pune',
              customerType: CustomerType.RETAILER,
              creditLimit: 7500000n, // ₹75,000
              paymentTermsDays: 30,
              status: CreditStatus.GREEN,
              isActive: true,
            },
          });

          // Ledger opening entries
          await prisma.ledgerEntry.createMany({
            data: [
              {
                tenantId: dbTenant.id,
                customerId: c1.id,
                entryType: LedgerEntryType.ADJUSTMENT,
                debit: 1245000n, // ₹12,450
                credit: 0n,
                narration: 'Opening Khata Balance (Verified)',
              },
              {
                tenantId: dbTenant.id,
                customerId: c2.id,
                entryType: LedgerEntryType.ADJUSTMENT,
                debit: 320000n, // ₹3,200
                credit: 0n,
                narration: 'Opening Balance (Previous Week Bills)',
              },
            ],
          });
        }

        // Ensure 10 Products Exist
        const existingProdCount = await prisma.product.count({ where: { tenantId: dbTenant.id } });
        if (existingProdCount < 10) {
          const sampleProducts = [
            { name: 'NGK Spark Plug CPR8EA-9', partNumber: 'SPK-NGK-CPR8', brand: 'NGK', category: 'Electrical & Ignition', hsnCode: '8511', gstRateBp: 1800, unit: 'pcs', purchasePrice: 7500n, salePrice: 13500n, mrp: 16000n, reorderLevel: 15, stock: 85 },
            { name: 'Motul 4T Plus 10W-30 (900ml)', partNumber: 'OIL-MOT-10W30', brand: 'Motul', category: 'Lubricants & Fluids', hsnCode: '2710', gstRateBp: 1800, unit: 'can', purchasePrice: 25500n, salePrice: 36000n, mrp: 42000n, reorderLevel: 10, stock: 48 },
            { name: 'Front Brake Shoe Set', partNumber: 'BRK-SH-FR01', brand: 'KBX / Bosch', category: 'Brakes & Friction', hsnCode: '8714', gstRateBp: 1800, unit: 'set', purchasePrice: 14500n, salePrice: 24000n, mrp: 28000n, reorderLevel: 8, stock: 32 },
            { name: 'Rolon Heavy Duty Chain Sprocket Kit', partNumber: 'CHN-RLN-041', brand: 'Rolon', category: 'Transmission & Drive', hsnCode: '8714', gstRateBp: 1800, unit: 'kit', purchasePrice: 62000n, salePrice: 89000n, mrp: 105000n, reorderLevel: 5, stock: 18 },
            { name: 'High Flow Air Filter Element', partNumber: 'FLT-AIR-AC16', brand: 'Purolator', category: 'Filters & Intake', hsnCode: '8421', gstRateBp: 1800, unit: 'pcs', purchasePrice: 9500n, salePrice: 18000n, mrp: 22000n, reorderLevel: 10, stock: 40 },
            { name: 'Endurance Clutch Cable Complete', partNumber: 'CBL-CL-091', brand: 'Endurance', category: 'Cables & Controls', hsnCode: '8714', gstRateBp: 1800, unit: 'pcs', purchasePrice: 8000n, salePrice: 14000n, mrp: 16500n, reorderLevel: 10, stock: 25 },
            { name: 'Bosch Rear Brake Pad Set', partNumber: 'BRK-PD-RR02', brand: 'Bosch', category: 'Brakes & Friction', hsnCode: '8714', gstRateBp: 1800, unit: 'set', purchasePrice: 18000n, salePrice: 29500n, mrp: 35000n, reorderLevel: 6, stock: 22 },
            { name: 'Exide 12V 4Ah Maintenance Free Battery', partNumber: 'BAT-EX-12V4', brand: 'Exide', category: 'Electrical & Ignition', hsnCode: '8507', gstRateBp: 1800, unit: 'pcs', purchasePrice: 85000n, salePrice: 125000n, mrp: 145000n, reorderLevel: 4, stock: 12 },
            { name: 'Castrol Activ 20W-40 4T (1L)', partNumber: 'OIL-CAS-20W40', brand: 'Castrol', category: 'Lubricants & Fluids', hsnCode: '2710', gstRateBp: 1800, unit: 'can', purchasePrice: 29000n, salePrice: 41000n, mrp: 48000n, reorderLevel: 10, stock: 35 },
            { name: 'Halogen Headlamp Bulb 12V 35/35W', partNumber: 'LGT-HL-35W', brand: 'Osram', category: 'Lighting & Horns', hsnCode: '8539', gstRateBp: 1800, unit: 'pcs', purchasePrice: 4500n, salePrice: 8500n, mrp: 11000n, reorderLevel: 15, stock: 60 },
          ];

          for (const sp of sampleProducts) {
            const p = await prisma.product.create({
              data: {
                tenantId: dbTenant.id,
                name: sp.name,
                partNumber: sp.partNumber,
                brand: sp.brand,
                category: sp.category,
                hsnCode: sp.hsnCode,
                gstRateBp: sp.gstRateBp,
                unit: sp.unit,
                purchasePrice: sp.purchasePrice,
                salePrice: sp.salePrice,
                mrp: sp.mrp,
                reorderLevel: sp.reorderLevel,
                isActive: true,
              },
            });
            await prisma.stockMovement.create({
              data: {
                tenantId: dbTenant.id,
                productId: p.id,
                qty: sp.stock,
                reason: StockReason.OPENING,
                unitCost: sp.purchasePrice,
                createdBy: dbUser.id,
              },
            });
          }
        }

        // Ensure 2 Sample Invoices Exist
        const existingInvCount = await prisma.invoice.count({ where: { tenantId: dbTenant.id } });
        if (existingInvCount < 2) {
          const cust = await prisma.customer.findFirst({ where: { tenantId: dbTenant.id } });
          const prods = await prisma.product.findMany({ where: { tenantId: dbTenant.id }, take: 2 });
          if (cust && prods.length >= 2) {
            const p0 = prods[0];
            const p1 = prods[1];
            const price0 = p0.salePrice ?? 24000n;
            const price1 = p1.salePrice ?? 36000n;
            await prisma.invoice.create({
              data: {
                tenantId: dbTenant.id,
                number: 'INV-DEMO-001',
                invoiceType: InvoiceType.RETAIL_BILL,
                status: InvoiceStatus.PARTIALLY_PAID,
                customerId: cust.id,
                placeOfSupply: '27',
                taxableValue: price0 * 2n,
                subtotal: price0 * 2n,
                grandTotal: price0 * 2n,
                paidNow: 100000n,
                createdBy: dbUser.id,
                items: {
                  create: [
                    {
                      productId: p0.id,
                      description: p0.name,
                      hsnCode: p0.hsnCode,
                      unit: p0.unit,
                      qty: 2,
                      rate: price0,
                      discount: 0n,
                      taxableValue: price0 * 2n,
                      gstRateBp: p0.gstRateBp,
                      taxAmount: 0n,
                      lineTotal: price0 * 2n,
                    },
                  ],
                },
              },
            });
            await prisma.invoice.create({
              data: {
                tenantId: dbTenant.id,
                number: 'INV-DEMO-002',
                invoiceType: InvoiceType.RETAIL_BILL,
                status: InvoiceStatus.ISSUED,
                customerId: cust.id,
                placeOfSupply: '27',
                taxableValue: price1,
                subtotal: price1,
                grandTotal: price1,
                paidNow: 0n,
                createdBy: dbUser.id,
                items: {
                  create: [
                    {
                      productId: p1.id,
                      description: p1.name,
                      hsnCode: p1.hsnCode,
                      unit: p1.unit,
                      qty: 1,
                      rate: price1,
                      discount: 0n,
                      taxableValue: price1,
                      gstRateBp: p1.gstRateBp,
                      taxAmount: 0n,
                      lineTotal: price1,
                    },
                  ],
                },
              },
            });
          }
        }
      } catch (err) {
        console.warn('Postgres demo provisioning warning, continuing to localStore:', err);
      }
    }

    // =========================================================================
    // 2. LOCALSTORE FALLBACK PROVISIONING
    // =========================================================================
    let localTenant = localStore.getTenants().find((t) => t.name === DEMO_TENANT_NAME);
    if (!localTenant) {
      localTenant = localStore.createTenant({
        name: DEMO_TENANT_NAME,
        legalName: 'AutoLedger Demo Motors LLP',
        gstin: '27AABCA1234F1Z9',
        address: 'Shop No. 12-14, Pune Auto Spare Market, Nana Peth, Pune - 411002',
        stateCode: '27',
        phone: DEMO_PHONE,
        email: DEMO_EMAIL,
        upiId: 'autoledger.demo@icici',
      });
    }

    if (!tenantId) {
      tenantId = localTenant.id;
    }

    let localUser = localStore.findUser(DEMO_EMAIL);
    if (!localUser) {
      localUser = localStore.createUser({
        tenantId: localTenant.id,
        name: 'Rajesh Sharma (Owner)',
        email: DEMO_EMAIL,
        phone: DEMO_PHONE,
        password: hashedPassword,
        role: 'OWNER',
        isActive: true,
      });
    }

    if (!userId) {
      userId = localUser.id;
    }

    // Issue JWT Token
    const token = signToken({
      userId: userId!,
      tenantId: tenantId!,
      role: 'OWNER',
      name: userName,
      phone: DEMO_PHONE,
    });

    const response = NextResponse.json({
      success: true,
      message: 'Demo session authenticated successfully',
      user: {
        id: userId,
        name: userName,
        email: DEMO_EMAIL,
        phone: DEMO_PHONE,
        role: 'OWNER',
        tenant: {
          id: tenantId,
          name: tenantName,
        },
      },
      redirectUrl: '/',
    });

    response.cookies.set({
      name: TOKEN_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Demo login failed';
    console.error('Demo login error:', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
