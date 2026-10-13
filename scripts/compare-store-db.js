const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const store = JSON.parse(fs.readFileSync('.data/db_store.json', 'utf8'));
  const dbInvs = await prisma.invoice.findMany({ select: { id: true, number: true, tenantId: true } });
  const dbInvNumbers = new Set(dbInvs.map(i => i.number));
  console.log('Total DB invoices:', dbInvs.length);
  console.log('Total Store invoices:', (store.invoices || []).length);
  
  const missingFromDb = (store.invoices || []).filter(i => !dbInvNumbers.has(i.invoiceNumber));
  console.log('Invoices in store but missing from DB:', missingFromDb.length);
  for (const m of missingFromDb) {
    console.log({ id: m.id, number: m.invoiceNumber, tenantId: m.tenantId, grandTotal: m.grandTotalPaise });
  }

  const dbCusts = await prisma.customer.findMany({ select: { id: true, phone: true, name: true, tenantId: true } });
  const dbCustPhones = new Set(dbCusts.map(c => c.phone));
  const missingCusts = (store.customers || []).filter(c => !dbCustPhones.has(c.phone));
  console.log('Customers in store missing from DB:', missingCusts.map(c => ({ name: c.name, phone: c.phone, tenantId: c.tenantId })));
  
  const dbPayments = await prisma.payment.findMany();
  console.log('DB Payments count:', dbPayments.length);
  console.log('Store Payments count:', (store.payments || []).length);

  await prisma.$disconnect();
}
check();
