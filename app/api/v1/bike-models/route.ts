import { NextRequest, NextResponse } from 'next/server';
import { prisma, isPostgresAvailable } from '@/server/lib/prisma';
import { getAuthenticatedUser } from '@/server/lib/auth';

const DEFAULT_MODELS = [
  { make: 'Hero', model: 'Splendor Plus' },
  { make: 'Hero', model: 'HF Deluxe' },
  { make: 'Hero', model: 'Glamour 125' },
  { make: 'Hero', model: 'Passion Pro' },
  { make: 'Honda', model: 'Activa 6G / 5G' },
  { make: 'Honda', model: 'Shine 125' },
  { make: 'Honda', model: 'Dio 110' },
  { make: 'Honda', model: 'Unicorn 150/160' },
  { make: 'Bajaj', model: 'Pulsar 150 / 180' },
  { make: 'Bajaj', model: 'Platina 100 / 110' },
  { make: 'Bajaj', model: 'CT 100' },
  { make: 'TVS', model: 'Apache RTR 160 / 180' },
  { make: 'TVS', model: 'Jupiter 110 / 125' },
  { make: 'TVS', model: 'XL 100 Heavy Duty' },
  { make: 'Yamaha', model: 'FZ-S / FZ Version 3' },
  { make: 'Yamaha', model: 'Ray ZR 125' },
  { make: 'Royal Enfield', model: 'Classic 350' },
  { make: 'Royal Enfield', model: 'Bullet 350' },
];

export async function GET(req: NextRequest) {
  try {
    const hasDb = await isPostgresAvailable();
    if (!hasDb) {
      return NextResponse.json({
        success: true,
        bikeModels: DEFAULT_MODELS.map((m, idx) => ({
          id: `bm-${idx}`,
          make: m.make,
          model: m.model,
          yearFrom: null,
          yearTo: null,
        })),
      });
    }

    const authUser = await getAuthenticatedUser(req);
    let targetTenantId = authUser?.tenantId;

    if (!targetTenantId) {
      const firstTenant = await prisma.tenant.findFirst();
      if (firstTenant) targetTenantId = firstTenant.id;
    }

    let bikeModels: any[] = [];
    if (targetTenantId) {
      bikeModels = await prisma.bikeModel.findMany({
        where: { tenantId: targetTenantId },
        orderBy: [{ make: 'asc' }, { model: 'asc' }],
      });

      if (bikeModels.length === 0) {
        await prisma.bikeModel.createMany({
          data: DEFAULT_MODELS.map(m => ({
            tenantId: targetTenantId!,
            make: m.make,
            model: m.model,
          }))
        });

        bikeModels = await prisma.bikeModel.findMany({
          where: { tenantId: targetTenantId },
          orderBy: [{ make: 'asc' }, { model: 'asc' }],
        });
      }
    } else {
      bikeModels = DEFAULT_MODELS.map((m, idx) => ({
        id: `bm-${idx}`,
        make: m.make,
        model: m.model,
      }));
    }

    return NextResponse.json({ success: true, models: bikeModels });
  } catch (error: any) {
    console.error('Error fetching bike models:', error);
    return NextResponse.json({ success: true, models: DEFAULT_MODELS.map((m, idx) => ({ id: `bm-${idx}`, make: m.make, model: m.model })) });
  }
}
