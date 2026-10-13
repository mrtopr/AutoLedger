const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany({
    include: {
      users: true,
      _count: {
        select: {
          products: true,
          customers: true,
          invoices: true,
          payments: true
        }
      }
    }
  });

  console.log('Tenants in DB:');
  for (const t of tenants) {
    console.log(`Tenant: ${t.name} (${t.id})`);
    console.log('  Users:', t.users.map(u => ({ id: u.id, email: u.email, phone: u.phone, role: u.role })));
    console.log('  Counts:', t._count);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
