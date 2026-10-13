const fs = require('fs');
const { PrismaClient, Role, InvoiceStatus, InvoiceType, LedgerEntryType, PaymentMode, PaymentStatus } = require('@prisma/client');
const { randomUUID } = require('crypto');

const prisma = new PrismaClient();

const isUuid = (id) =>
  typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

async function main() {
  console.log('🚀 Starting Full Database Migration and Synchronization...');

  if (!fs.existsSync('.data/db_store.json')) {
    console.error('❌ .data/db_store.json not found!');
    return;
  }

  const store = JSON.parse(fs.readFileSync('.data/db_store.json', 'utf8'));

  // 1. Fetch current DB state
  const dbTenants = await prisma.tenant.findMany();
  console.log(`Found ${dbTenants.length} tenants in PostgreSQL.`);
  for (const t of dbTenants) {
    console.log(` - DB Tenant: "${t.name}" / "${t.legalName}" (${t.id}), GSTIN: ${t.gstin}`);
  }

  // Build Tenant Mapping: localTenantId -> dbTenantId
  const tenantMap = new Map();

  // Explicit known mappings:
  // "honda" / "Shree Honda" / "TVSMOTO123"
  const hondaDbTenant = dbTenants.find(t => t.name.toLowerCase() === 'honda' || t.gstin === 'TVSMOTO123') || dbTenants[0];
  const vishwakarmaDbTenant = dbTenants.find(t => t.name.toUpperCase().includes('VISHWAKARMA') || t.id === '722f97e3-f41a-48aa-b3a3-d9b0ef810322');
  const apexDbTenant = dbTenants.find(t => t.id === '0476b16f-cabc-44c7-8213-a348c78bc70c');

  tenantMap.set('tenant-1791362565938', hondaDbTenant.id);
  tenantMap.set('tenant-honda-1', hondaDbTenant.id);
  if (vishwakarmaDbTenant) {
    tenantMap.set('722f97e3-f41a-48aa-b3a3-d9b0ef810322', vishwakarmaDbTenant.id);
    tenantMap.set('tenant-royal-1', vishwakarmaDbTenant.id);
  }
  if (apexDbTenant) {
    tenantMap.set('0476b16f-cabc-44c7-8213-a348c78bc70c', apexDbTenant.id);
  }

  // Handle other tenants in store (e.g. Bajajj)
  for (const lt of store.tenants || []) {
    if (!tenantMap.has(lt.id)) {
      // Find matching by GSTIN or Name
      const match = dbTenants.find(dt => (lt.gstin && dt.gstin === lt.gstin) || (lt.name && dt.name.toLowerCase() === lt.name.toLowerCase()));
      if (match) {
        tenantMap.set(lt.id, match.id);
      } else {
        // Create new tenant in DB
        const newTenant = await prisma.tenant.create({
          data: {
            id: randomUUID(),
            name: lt.name || 'Business',
            legalName: lt.legalName || lt.name || 'Business',
            gstin: lt.gstin || null,
            address: lt.address || null,
            stateCode: lt.stateCode || '27',
            upiId: lt.upiId || null,
            bankDetails: lt.bankDetails || null,
            settings: {
              phone: lt.phone || null,
              email: lt.email || null,
              ...(lt.settings || {}),
            },
          }
        });
        console.log(`Created new tenant in DB for "${lt.name}": ${newTenant.id}`);
        tenantMap.set(lt.id, newTenant.id);
        dbTenants.push(newTenant);
      }
    }
  }

  console.log('Tenant mappings established:');
  for (const [k, v] of tenantMap.entries()) {
    console.log(`  ${k} -> ${v}`);
  }

  // 2. Migrate USERS
  console.log('\n--- Syncing Users ---');
  const userMap = new Map();
  for (const su of store.users || []) {
    const targetTenantId = tenantMap.get(su.tenantId) || hondaDbTenant.id;
    let dbUser = await prisma.user.findFirst({
      where: {
        OR: [
          ...(su.email ? [{ email: su.email.toLowerCase() }] : []),
          ...(su.phone ? [{ phone: su.phone }] : [])
        ]
      }
    });

    if (!dbUser) {
      dbUser = await prisma.user.create({
        data: {
          id: randomUUID(),
          tenantId: targetTenantId,
          name: su.name || 'User',
          phone: su.phone || `98${Math.floor(10000000 + Math.random() * 90000000)}`,
          email: su.email ? su.email.toLowerCase() : null,
          password: su.password || null,
          role: su.role || Role.COUNTER_STAFF,
          isActive: su.isActive !== false,
        }
      });
      console.log(`✅ Created DB User: ${dbUser.name} (${dbUser.email || dbUser.phone}) -> Tenant: ${targetTenantId}`);
    } else {
      // Update tenant or credentials if needed
      await prisma.user.update({
        where: { id: dbUser.id },
        data: {
          name: su.name || dbUser.name,
          role: su.role || dbUser.role,
          isActive: true,
          ...(su.password ? { password: su.password } : {})
        }
      });
      console.log(`ℹ️ Updated DB User: ${dbUser.name} (${dbUser.email || dbUser.phone})`);
    }
    userMap.set(su.id, dbUser.id);
  }

  // 3. Migrate CUSTOMERS
  console.log('\n--- Syncing Customers ---');
  const custMap = new Map();
  for (const sc of store.customers || []) {
    const targetTenantId = tenantMap.get(sc.tenantId) || hondaDbTenant.id;
    let dbCust = await prisma.customer.findFirst({
      where: {
        tenantId: targetTenantId,
        phone: sc.phone
      }
    });

    let cType = 'GARAGE';
    if (sc.customerType === 'RETAILER' || sc.customerType === 'DISTRIBUTOR' || sc.customerType === 'WHOLESALER') {
      cType = 'RETAILER';
    } else if (sc.customerType === 'WALK_IN') {
      cType = 'WALK_IN';
    }

    if (!dbCust) {
      dbCust = await prisma.customer.create({
        data: {
          id: randomUUID(),
          tenantId: targetTenantId,
          name: sc.name || 'Customer',
          shopName: sc.shopName || sc.name || 'Customer',
          phone: sc.phone || '',
          address: sc.address || null,
          gstin: sc.gstin || null,
          customerType: cType,
          creditLimit: BigInt(sc.creditLimitPaise || sc.creditLimit || '5000000'),
          paymentTermsDays: Number(sc.termsDays || sc.paymentTermsDays || 15),
          status: ['GREEN', 'YELLOW', 'RED'].includes(sc.status) ? sc.status : 'GREEN',
          isActive: true,
        }
      });
      console.log(`✅ Created DB Customer: ${dbCust.name} (${dbCust.phone}) -> Tenant: ${targetTenantId}`);
    }
    custMap.set(sc.id, dbCust.id);
  }

  // Also ensure customers exist for all tenants if they belong to those tenants
  // For Apex tenant (0476b16f-cabc-44c7-8213-a348c78bc70c)
  if (apexDbTenant) {
    const apexCustomers = (store.customers || []).filter(c => c.tenantId === '0476b16f-cabc-44c7-8213-a348c78bc70c');
    for (const sc of apexCustomers) {
      let dbCust = await prisma.customer.findFirst({
        where: { tenantId: apexDbTenant.id, phone: sc.phone }
      });
      if (!dbCust) {
        dbCust = await prisma.customer.create({
          data: {
            id: randomUUID(),
            tenantId: apexDbTenant.id,
            name: sc.name,
            shopName: sc.shopName || sc.name,
            phone: sc.phone,
            address: sc.address || null,
            gstin: sc.gstin || null,
            creditLimit: BigInt(sc.creditLimitPaise || '5000000'),
            paymentTermsDays: Number(sc.termsDays || 15),
          }
        });
        console.log(`✅ Created Apex Customer in DB: ${dbCust.name}`);
        custMap.set(sc.id, dbCust.id);
      }
    }
  }

  // 4. Migrate PRODUCTS
  console.log('\n--- Syncing Products to PostgreSQL ---');
  // Group store products by mapped tenant
  const productsByTenant = new Map();
  for (const sp of store.products || []) {
    const mappedTid = tenantMap.get(sp.tenantId) || hondaDbTenant.id;
    if (!productsByTenant.has(mappedTid)) productsByTenant.set(mappedTid, []);
    productsByTenant.get(mappedTid).push(sp);
  }

  // If Honda DB tenant has < 19000 products, or if any tenant needs products
  for (const [tId, pList] of productsByTenant.entries()) {
    const currentDbProdCount = await prisma.product.count({ where: { tenantId: tId } });
    console.log(`Tenant ${tId} currently has ${currentDbProdCount} products in DB (store has ${pList.length}).`);

    if (currentDbProdCount >= 1000) {
      console.log(`ℹ️ Tenant ${tId} already has ${currentDbProdCount} products in PostgreSQL. Skipping redundant bulk upload.`);
      continue;
    }

    const prodsToInsert = pList.map((sp, idx) => ({
      id: randomUUID(),
      tenantId: tId,
      name: sp.name.trim(),
      partNumber: sp.partNumber || `SKU-${Date.now().toString(36).toUpperCase()}-${idx}`,
      brand: sp.brand || null,
      category: sp.category || null,
      hsnCode: sp.hsnCode || '8714',
      gstRateBp: Number(sp.gstRateBp) || 1800,
      unit: sp.unit || 'pcs',
      purchasePrice: BigInt(sp.purchasePricePaise || 0),
      salePrice: BigInt(sp.salePricePaise || 0),
      mrp: BigInt(sp.mrpPaise || sp.salePricePaise || 0),
      reorderLevel: Number(sp.reorderLevel) || 5,
      isActive: true,
    }));

    if (prodsToInsert.length > 0) {
      console.log(`Inserting ${prodsToInsert.length} products into DB for tenant ${tId}...`);
      const CHUNK = 500;
      for (let i = 0; i < prodsToInsert.length; i += CHUNK) {
        await prisma.product.createMany({
          data: prodsToInsert.slice(i, i + CHUNK),
          skipDuplicates: true
        });
      }
      console.log(`✅ Uploaded ${prodsToInsert.length} products to DB!`);
    }
  }

  // 5. Migrate INVOICES
  console.log('\n--- Syncing Invoices to PostgreSQL ---');
  const dbInvoices = await prisma.invoice.findMany({ select: { id: true, number: true, tenantId: true } });
  const dbInvNumberSet = new Set(dbInvoices.map(i => `${i.tenantId}:${i.number}`));

  let insertedInvCount = 0;
  for (const sinv of store.invoices || []) {
    const targetTenantId = tenantMap.get(sinv.tenantId) || hondaDbTenant.id;
    const invKey = `${targetTenantId}:${sinv.invoiceNumber}`;
    if (dbInvNumberSet.has(invKey)) {
      continue;
    }

    const mappedCustId = (sinv.customerId && custMap.get(sinv.customerId)) ||
      (isUuid(sinv.customerId) ? sinv.customerId : null);

    const grandTotal = BigInt(sinv.grandTotalPaise || 0);
    const paidNow = BigInt(sinv.paidNowPaise || 0);
    const balanceDue = BigInt(sinv.creditBalancePaise || (grandTotal > paidNow ? grandTotal - paidNow : 0n));
    const invDate = sinv.createdAt ? new Date(sinv.createdAt) : new Date();

    const createdInvoice = await prisma.invoice.create({
      data: {
        id: randomUUID(),
        tenantId: targetTenantId,
        customerId: mappedCustId,
        invoiceType: InvoiceType.TAX_INVOICE,
        number: sinv.invoiceNumber,
        seriesCode: 'INV',
        status: paidNow >= grandTotal ? InvoiceStatus.PAID : InvoiceStatus.ISSUED,
        subtotal: grandTotal,
        discountTotal: 0n,
        taxableValue: grandTotal,
        cgst: 0n,
        sgst: 0n,
        igst: 0n,
        roundOff: 0n,
        grandTotal: grandTotal,
        paidNow: paidNow,
        amountPaid: paidNow,
        balanceDue: balanceDue,
        createdAt: invDate,
        items: {
          create: (sinv.items || []).map((it) => ({
            id: randomUUID(),
            productId: isUuid(it.productId) ? it.productId : null,
            description: it.name || it.description || 'Auto Part',
            hsnCode: it.hsnCode || '8714',
            gstRateBp: Number(it.gstRateBp) || 1800,
            unit: it.unit || 'pcs',
            qty: Number(it.qty) || 1,
            rate: BigInt(it.ratePaise || 0),
            discount: BigInt(it.discountPaise || 0),
            taxableValue: BigInt(it.ratePaise || 0) * BigInt(Number(it.qty) || 1),
            taxAmount: 0n,
            lineTotal: BigInt(it.totalPaise || it.ratePaise || 0),
          }))
        }
      }
    });

    dbInvNumberSet.add(invKey);
    insertedInvCount++;

    // Post Double-Entry Ledger Entry if customer attached
    if (mappedCustId) {
      await prisma.ledgerEntry.create({
        data: {
          id: randomUUID(),
          tenantId: targetTenantId,
          customerId: mappedCustId,
          entryType: LedgerEntryType.INVOICE,
          refId: createdInvoice.id,
          debit: grandTotal,
          credit: 0n,
          narration: `Tax Invoice #${sinv.invoiceNumber}`,
          createdAt: invDate,
        }
      });

      if (paidNow > 0n) {
        await prisma.ledgerEntry.create({
          data: {
            id: randomUUID(),
            tenantId: targetTenantId,
            customerId: mappedCustId,
            entryType: LedgerEntryType.PAYMENT,
            refId: createdInvoice.id,
            debit: 0n,
            credit: paidNow,
            narration: `Counter payment for Invoice #${sinv.invoiceNumber}`,
            createdAt: invDate,
          }
        });
      }
    }
  }
  console.log(`✅ Uploaded ${insertedInvCount} invoices to PostgreSQL!`);

  // 6. Migrate PAYMENTS
  console.log('\n--- Syncing Payments to PostgreSQL ---');
  const dbPayments = await prisma.payment.findMany({ select: { id: true, reference: true, tenantId: true } });
  const dbPayRefSet = new Set(dbPayments.map(p => `${p.tenantId}:${p.reference}`));

  let insertedPayCount = 0;
  for (const sp of store.payments || []) {
    const targetTenantId = tenantMap.get(sp.tenantId) || hondaDbTenant.id;
    const ref = sp.referenceNumber || `PAY-${sp.id}`;
    const payKey = `${targetTenantId}:${ref}`;
    if (dbPayRefSet.has(payKey)) continue;

    const mappedCustId = (sp.customerId && custMap.get(sp.customerId)) ||
      (isUuid(sp.customerId) ? sp.customerId : null);

    if (!mappedCustId) continue;

    const amt = BigInt(sp.amountPaise || 0);
    const pDate = sp.createdAt ? new Date(sp.createdAt) : new Date();

    let pMode = PaymentMode.UPI;
    if (sp.mode === 'CASH') pMode = PaymentMode.CASH;
    else if (sp.mode === 'BANK') pMode = PaymentMode.BANK;
    else if (sp.mode === 'CHEQUE') pMode = PaymentMode.CHEQUE;

    const createdPayment = await prisma.payment.create({
      data: {
        id: randomUUID(),
        tenantId: targetTenantId,
        customerId: mappedCustId,
        amount: amt,
        mode: pMode,
        reference: ref,
        status: PaymentStatus.CLEARED,
        createdAt: pDate,
      }
    });

    await prisma.ledgerEntry.create({
      data: {
        id: randomUUID(),
        tenantId: targetTenantId,
        customerId: mappedCustId,
        entryType: LedgerEntryType.PAYMENT,
        refId: createdPayment.id,
        debit: 0n,
        credit: amt,
        narration: `Payment received via ${sp.mode} (${ref})`,
        createdAt: pDate,
      }
    });

    dbPayRefSet.add(payKey);
    insertedPayCount++;
  }
  console.log(`✅ Uploaded ${insertedPayCount} payments to PostgreSQL!`);

  // 7. Harmonize localStore .data/db_store.json with PostgreSQL UUIDs
  console.log('\n--- Harmonizing local db_store.json with DB UUIDs ---');
  let storeModified = false;
  for (const u of store.users || []) {
    if (tenantMap.has(u.tenantId)) {
      u.tenantId = tenantMap.get(u.tenantId);
      storeModified = true;
    }
    if (userMap.has(u.id)) {
      u.id = userMap.get(u.id);
      storeModified = true;
    }
  }

  for (const c of store.customers || []) {
    if (tenantMap.has(c.tenantId)) {
      c.tenantId = tenantMap.get(c.tenantId);
      storeModified = true;
    }
    if (custMap.has(c.id)) {
      c.id = custMap.get(c.id);
      storeModified = true;
    }
  }

  for (const inv of store.invoices || []) {
    if (tenantMap.has(inv.tenantId)) {
      inv.tenantId = tenantMap.get(inv.tenantId);
      storeModified = true;
    }
    if (inv.customerId && custMap.has(inv.customerId)) {
      inv.customerId = custMap.get(inv.customerId);
      storeModified = true;
    }
  }

  for (const p of store.products || []) {
    if (tenantMap.has(p.tenantId)) {
      p.tenantId = tenantMap.get(p.tenantId);
      storeModified = true;
    }
  }

  for (const pay of store.payments || []) {
    if (tenantMap.has(pay.tenantId)) {
      pay.tenantId = tenantMap.get(pay.tenantId);
      storeModified = true;
    }
    if (pay.customerId && custMap.has(pay.customerId)) {
      pay.customerId = custMap.get(pay.customerId);
      storeModified = true;
    }
  }

  if (storeModified) {
    fs.writeFileSync('.data/db_store.json', JSON.stringify(store, null, 2), 'utf8');
    console.log('✅ Updated .data/db_store.json to use unified PostgreSQL UUIDs!');
  }

  console.log('\n🎉 ALL DATA HAS BEEN SUCCESSFULLY UPLOADED & SYNCED TO POSTGRESQL!');
}

main()
  .catch((e) => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
