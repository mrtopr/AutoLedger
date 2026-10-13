const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Testing DB connection...');
    const tenants = await prisma.tenant.findMany();
    console.log('DB Tenants:', tenants.length, tenants);
    const users = await prisma.user.findMany({ select: { id: true, email: true, role: true, tenantId: true } });
    console.log('DB Users:', users.length, users);
    const prodCount = await prisma.product.count();
    console.log('DB Products count:', prodCount);
    const invCount = await prisma.invoice.count();
    console.log('DB Invoices count:', invCount);
    const custCount = await prisma.customer.count();
    console.log('DB Customers count:', custCount);
  } catch (err) {
    console.error('DB Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
