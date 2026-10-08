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

export async function GET(req: NextRequest) {
  try {
    const session = parseCustomerSession(req);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in with your phone number.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q')?.toLowerCase() || '';
    const category = searchParams.get('category') || '';
    const model = searchParams.get('model') || '';

    const hasDb = await isPostgresAvailable();
    let products: any[] = [];

    if (hasDb) {
      try {
        const dbProducts = await prisma.product.findMany({
          where: {
            isActive: true,
            ...(category && category !== 'ALL' ? { category: { equals: category, mode: 'insensitive' } } : {}),
            ...(query ? {
              OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { partNumber: { contains: query, mode: 'insensitive' } },
                { brand: { contains: query, mode: 'insensitive' } },
              ]
            } : {})
          },
          orderBy: { name: 'asc' },
          take: 100,
        });

        products = dbProducts.map((p) => ({
          id: p.id,
          name: p.name,
          partNumber: p.partNumber || 'GEN-PART',
          brand: p.brand || 'GENUINE OEM',
          category: p.category || 'General Spares',
          hsnCode: p.hsnCode || '87141090',
          salePricePaise: (p.salePrice || 0n).toString(),
          mrpPaise: (p.mrp || p.salePrice || 0n).toString(),
          stockQty: (p as any).stockQty || 0,
          models: (p as any).models || ['Universal', 'Honda Activa', 'Hero Splendor', 'Bajaj Pulsar'],
        }));
      } catch (dbErr) {
        console.warn('Postgres catalog query failed, falling back to localStore:', dbErr);
      }
    }

    if (products.length === 0) {
      const allLocal = localStore.getProducts();
      products = allLocal.map((p) => ({
        id: p.id,
        name: p.name,
        partNumber: p.partNumber || 'GEN-PART',
        brand: p.brand || 'GENUINE OEM',
        category: p.category || 'General Spares',
        hsnCode: p.hsnCode || '87141090',
        salePricePaise: p.salePricePaise || '0',
        mrpPaise: p.mrpPaise || p.salePricePaise || '0',
        stockQty: p.stockQty || 0,
        models: p.models && p.models.length > 0 ? p.models : ['Honda Activa 6G', 'Hero Splendor+', 'Honda Shine', 'Bajaj Pulsar 150'],
      }));

      if (query) {
        products = products.filter(
          (p) =>
            p.name.toLowerCase().includes(query) ||
            p.partNumber.toLowerCase().includes(query) ||
            p.brand.toLowerCase().includes(query) ||
            p.models.some((m: string) => m.toLowerCase().includes(query))
        );
      }

      if (category && category !== 'ALL') {
        products = products.filter((p) => p.category.toLowerCase() === category.toLowerCase());
      }

      if (model && model !== 'ALL') {
        products = products.filter((p) => p.models.some((m: string) => m.toLowerCase().includes(model.toLowerCase())));
      }
    }

    // Extract unique categories & vehicle models for filters
    const categories = Array.from(new Set(products.map((p) => p.category).filter(Boolean)));
    const allModels = Array.from(new Set(products.flatMap((p) => p.models || []).filter(Boolean)));

    return NextResponse.json({
      success: true,
      products,
      categories,
      models: allModels,
    });
  } catch (error: any) {
    console.error('Error fetching portal catalog:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch product catalog.' },
      { status: 500 }
    );
  }
}
