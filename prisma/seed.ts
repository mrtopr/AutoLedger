import { PrismaClient, Role, CustomerType, CreditStatus, StockReason, InvoiceType, InvoiceStatus, PaymentMode, LedgerEntryType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding B2B Motorbike-Parts Khata Platform database...');

  // 1. Clean existing records in reverse dependency order
  await prisma.auditLog.deleteMany({});
  await prisma.paymentAllocation.deleteMany({});
  await prisma.ledgerEntry.deleteMany({});
  await prisma.invoiceItem.deleteMany({});
  await prisma.invoiceVersion.deleteMany({});
  await prisma.invoiceEvent.deleteMany({});
  await prisma.invoiceDocument.deleteMany({});
  await prisma.shareLink.deleteMany({});
  await prisma.message.deleteMany({});
  await prisma.promise.deleteMany({});
  await prisma.creditNote.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.stockMovement.deleteMany({});
  await prisma.productCompatibility.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.bikeModel.deleteMany({});
  await prisma.supplier.deleteMany({});
  await prisma.creditLimitHistory.deleteMany({});
  await prisma.customerMetric.deleteMany({});
  await prisma.customer.deleteMany({});
  await prisma.messageTemplate.deleteMany({});
  await prisma.reminderRule.deleteMany({});
  await prisma.invoiceSeries.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.tenant.deleteMany({});

  // 2. Create Tenant (Wholesaler)
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Royal Auto Spares & Wholesalers',
      legalName: 'Royal Auto Spares LLP',
      gstin: '27ABCDE1234F1Z5',
      address: 'Shop No. 12-15, Nana Peth Auto Market, Pune, Maharashtra - 411002',
      stateCode: '27',
      upiId: 'royalautospares@icici',
      bankDetails: {
        bankName: 'ICICI Bank',
        accountName: 'Royal Auto Spares LLP',
        accountNumber: '001205001234',
        ifscCode: 'ICIC0000012',
        branch: 'Camp Branch, Pune'
      },
      settings: {
        credit: {
          defaultTermsDays: 15,
          policy: 'WARN', // WARN or BLOCK
          maxCreditLimitBumpPercent: 25
        },
        reminders: {
          quietHoursStart: '20:00',
          quietHoursEnd: '09:00',
          timezone: 'Asia/Kolkata'
        }
      }
    }
  });

  console.log(`✓ Created Tenant: ${tenant.name}`);

  // 3. Create Users
  const owner = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      name: 'Rajesh Sharma',
      phone: '9822012345',
      email: 'rajesh@royalautospares.com',
      role: Role.OWNER
    }
  });

  const manager = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      name: 'Amit Verma',
      phone: '9822054321',
      email: 'amit@royalautospares.com',
      role: Role.MANAGER
    }
  });

  const counterStaff = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      name: 'Suresh Patil',
      phone: '9822098765',
      email: 'suresh@royalautospares.com',
      role: Role.COUNTER_STAFF
    }
  });

  console.log(`✓ Created Users: Owner (${owner.name}), Manager (${manager.name}), Staff (${counterStaff.name})`);

  // 4. Create Invoice Series
  await prisma.invoiceSeries.createMany({
    data: [
      {
        tenantId: tenant.id,
        seriesCode: 'INV',
        fy: '2026-27',
        prefix: 'INV/2026-27/',
        lastNumber: 100
      },
      {
        tenantId: tenant.id,
        seriesCode: 'RET',
        fy: '2026-27',
        prefix: 'RET/2026-27/',
        lastNumber: 10
      }
    ]
  });

  // 5. Create Bike Models
  const bikeModelsData = [
    { make: 'Hero', model: 'Splendor Plus', yearFrom: 2012, yearTo: 2026 },
    { make: 'Hero', model: 'HF Deluxe', yearFrom: 2015, yearTo: 2026 },
    { make: 'Hero', model: 'Glamour 125', yearFrom: 2016, yearTo: 2026 },
    { make: 'Honda', model: 'Activa 6G / 5G', yearFrom: 2018, yearTo: 2026 },
    { make: 'Honda', model: 'Shine 125', yearFrom: 2014, yearTo: 2026 },
    { make: 'Bajaj', model: 'Pulsar 150 / 180', yearFrom: 2010, yearTo: 2026 },
    { make: 'Bajaj', model: 'Platina 100 / 110', yearFrom: 2014, yearTo: 2026 },
    { make: 'TVS', model: 'Apache RTR 160 / 180', yearFrom: 2016, yearTo: 2026 },
    { make: 'TVS', model: 'Jupiter 110 / 125', yearFrom: 2015, yearTo: 2026 },
    { make: 'Yamaha', model: 'FZ-S / FZ Version 3', yearFrom: 2017, yearTo: 2026 },
    { make: 'Royal Enfield', model: 'Classic 350 (Reborn / UCE)', yearFrom: 2012, yearTo: 2026 },
  ];

  const bikeModels: Record<string, string> = {};
  for (const b of bikeModelsData) {
    const created = await prisma.bikeModel.create({
      data: {
        tenantId: tenant.id,
        make: b.make,
        model: b.model,
        yearFrom: b.yearFrom,
        yearTo: b.yearTo
      }
    });
    bikeModels[`${b.make} ${b.model}`] = created.id;
  }
  console.log(`✓ Created ${Object.keys(bikeModels).length} Bike Models`);

  // 6. Create Products & Spare Parts Catalog (Paise amounts)
  const productsCatalog = [
    {
      name: 'Front Brake Shoe Set (Genuine Quality)',
      partNumber: 'BS-HERO-01',
      brand: 'ASK Genuine',
      category: 'Brakes & Friction',
      hsnCode: '8714',
      gstRateBp: 1800,
      unit: 'set',
      purchasePrice: 18000n, // ₹180.00
      salePrice: 24000n,     // ₹240.00
      mrp: 32000n,           // ₹320.00
      reorderLevel: 25,
      models: ['Hero Splendor Plus', 'Hero HF Deluxe', 'Hero Glamour 125']
    },
    {
      name: 'Front Disc Brake Pad Set',
      partNumber: 'BP-PULSAR-02',
      brand: 'KBX Brembo',
      category: 'Brakes & Friction',
      hsnCode: '8714',
      gstRateBp: 1800,
      unit: 'set',
      purchasePrice: 22000n, // ₹220.00
      salePrice: 29000n,     // ₹290.00
      mrp: 38000n,           // ₹380.00
      reorderLevel: 20,
      models: ['Bajaj Pulsar 150 / 180', 'TVS Apache RTR 160 / 180']
    },
    {
      name: 'Drive Chain Sprocket Complete Kit 428H',
      partNumber: 'CSK-SPL-112',
      brand: 'Rolon Gold',
      category: 'Transmission & Drive',
      hsnCode: '8483',
      gstRateBp: 1800,
      unit: 'kit',
      purchasePrice: 78000n,  // ₹780.00
      salePrice: 99000n,     // ₹990.00
      mrp: 125000n,          // ₹1,250.00
      reorderLevel: 15,
      models: ['Hero Splendor Plus', 'Hero HF Deluxe']
    },
    {
      name: 'Heavy Duty Chain Sprocket Kit 428-120L',
      partNumber: 'CSK-PULSAR-120',
      brand: 'Rolon Brass',
      category: 'Transmission & Drive',
      hsnCode: '8483',
      gstRateBp: 1800,
      unit: 'kit',
      purchasePrice: 110000n, // ₹1,100.00
      salePrice: 138000n,     // ₹1,380.00
      mrp: 175000n,          // ₹1,750.00
      reorderLevel: 10,
      models: ['Bajaj Pulsar 150 / 180', 'Yamaha FZ-S / FZ Version 3']
    },
    {
      name: 'Clutch Plate Set (Friction & Steel)',
      partNumber: 'CP-ACTIVA-6G',
      brand: 'FCC Clutch',
      category: 'Clutch & Engine',
      hsnCode: '8714',
      gstRateBp: 1800,
      unit: 'set',
      purchasePrice: 38000n,  // ₹380.00
      salePrice: 48000n,     // ₹480.00
      mrp: 62000n,           // ₹620.00
      reorderLevel: 20,
      models: ['Honda Activa 6G / 5G', 'Honda Shine 125']
    },
    {
      name: '4T 10W-30 Premium Engine Oil (900ml)',
      partNumber: 'OIL-CAST-4T-900',
      brand: 'Castrol Activ',
      category: 'Lubricants & Oils',
      hsnCode: '2710',
      gstRateBp: 1800,
      unit: 'can',
      purchasePrice: 34000n,  // ₹340.00
      salePrice: 41000n,     // ₹410.00
      mrp: 49500n,           // ₹495.00
      reorderLevel: 50,
      models: ['Hero Splendor Plus', 'Honda Activa 6G / 5G', 'Honda Shine 125']
    },
    {
      name: '4T 20W-50 Synthetic Engine Oil (1 Ltr)',
      partNumber: 'OIL-MOTUL-7100',
      brand: 'Motul 7100 4T',
      category: 'Lubricants & Oils',
      hsnCode: '2710',
      gstRateBp: 1800,
      unit: 'can',
      purchasePrice: 72000n,  // ₹720.00
      salePrice: 86000n,     // ₹860.00
      mrp: 102000n,          // ₹1,020.00
      reorderLevel: 30,
      models: ['Bajaj Pulsar 150 / 180', 'TVS Apache RTR 160 / 180', 'Royal Enfield Classic 350 (Reborn / UCE)']
    },
    {
      name: 'Spark Plug Nickel Alloy CPR8EA-9',
      partNumber: 'SP-NGK-CPR8',
      brand: 'NGK Japan',
      category: 'Ignition & Electrical',
      hsnCode: '8511',
      gstRateBp: 1800,
      unit: 'pcs',
      purchasePrice: 9500n,   // ₹95.00
      salePrice: 13500n,     // ₹135.00
      mrp: 18500n,           // ₹185.00
      reorderLevel: 100,
      models: ['Honda Activa 6G / 5G', 'Hero Splendor Plus', 'Yamaha FZ-S / FZ Version 3']
    },
    {
      name: 'Maintenance Free Battery 12V 5Ah',
      partNumber: 'BAT-EXIDE-5L',
      brand: 'Exide Xplore',
      category: 'Ignition & Electrical',
      hsnCode: '8507',
      gstRateBp: 2800,       // 28% GST on auto batteries
      unit: 'pcs',
      purchasePrice: 105000n, // ₹1,050.00
      salePrice: 129000n,    // ₹1,290.00
      mrp: 165000n,          // ₹1,650.00
      reorderLevel: 15,
      models: ['Honda Activa 6G / 5G', 'Bajaj Pulsar 150 / 180', 'Hero Glamour 125', 'TVS Jupiter 110 / 125']
    },
    {
      name: 'High Flow Air Filter Element',
      partNumber: 'AF-SPL-08',
      brand: 'Purolator',
      category: 'Filters',
      hsnCode: '8421',
      gstRateBp: 1800,
      unit: 'pcs',
      purchasePrice: 7500n,   // ₹75.00
      salePrice: 11000n,     // ₹110.00
      mrp: 15500n,           // ₹155.00
      reorderLevel: 40,
      models: ['Hero Splendor Plus', 'Hero HF Deluxe']
    },
    {
      name: 'Complete Front Fork Oil Seal & Bush Kit',
      partNumber: 'FS-PULSAR-31',
      brand: 'Endurance',
      category: 'Suspension & Chassis',
      hsnCode: '8714',
      gstRateBp: 1800,
      unit: 'set',
      purchasePrice: 16000n,  // ₹160.00
      salePrice: 22000n,     // ₹220.00
      mrp: 29000n,           // ₹290.00
      reorderLevel: 25,
      models: ['Bajaj Pulsar 150 / 180']
    },
    {
      name: 'Rear Shock Absorber Hydraulic Pair',
      partNumber: 'SA-SPL-BLK',
      brand: 'Gabriel Suspension',
      category: 'Suspension & Chassis',
      hsnCode: '8714',
      gstRateBp: 1800,
      unit: 'pair',
      purchasePrice: 125000n, // ₹1,250.00
      salePrice: 155000n,    // ₹1,550.00
      mrp: 198000n,          // ₹1,980.00
      reorderLevel: 8,
      models: ['Hero Splendor Plus', 'Hero HF Deluxe']
    }
  ];

  const createdProducts: any[] = [];
  for (const p of productsCatalog) {
    const product = await prisma.product.create({
      data: {
        tenantId: tenant.id,
        name: p.name,
        partNumber: p.partNumber,
        brand: p.brand,
        category: p.category,
        hsnCode: p.hsnCode,
        gstRateBp: p.gstRateBp,
        unit: p.unit,
        purchasePrice: p.purchasePrice,
        salePrice: p.salePrice,
        mrp: p.mrp,
        reorderLevel: p.reorderLevel
      }
    });

    createdProducts.push(product);

    // Link bike models
    for (const modelName of p.models) {
      const bikeModelId = bikeModels[modelName];
      if (bikeModelId) {
        await prisma.productCompatibility.create({
          data: {
            productId: product.id,
            bikeModelId: bikeModelId
          }
        });
      }
    }

    // Add initial opening stock movement (50 to 120 qty)
    await prisma.stockMovement.create({
      data: {
        tenantId: tenant.id,
        productId: product.id,
        qty: 100,
        reason: StockReason.OPENING,
        unitCost: p.purchasePrice,
        createdBy: owner.id
      }
    });
  }

  console.log(`✓ Created ${createdProducts.length} Products with Bike Compatibility and Opening Stock`);

  // 7. Create Sample Customers / Mechanics / Garages (20 customers across Pune)
  const customersData = [
    {
      name: 'Ramesh Jadhav',
      shopName: 'Ramesh Auto Works & Garage',
      phone: '9822100001',
      address: 'Rasta Peth, Near Apollo Talkies, Pune',
      gstin: '27AALPJ1122K1Z9',
      customerType: CustomerType.GARAGE,
      creditLimit: 5000000n, // ₹50,000.00
      paymentTermsDays: 15,
      status: CreditStatus.GREEN,
      whatsappOptIn: true,
      notes: 'Reliable payment record; pays every 10-12 days via UPI.'
    },
    {
      name: 'Santosh Kadam',
      shopName: 'Kadam Motor Care',
      phone: '9822100002',
      address: 'Hadapsar Gadital, Pune',
      gstin: '27BKLPK3344M1Z2',
      customerType: CustomerType.GARAGE,
      creditLimit: 3500000n, // ₹35,000.00
      paymentTermsDays: 15,
      status: CreditStatus.YELLOW,
      whatsappOptIn: true,
      notes: 'Frequently delays payment by 15-20 days; requires gentle reminder.'
    },
    {
      name: 'Mahesh Shinde',
      shopName: 'Shinde Bike Point',
      phone: '9822100003',
      address: 'Kothrud Depot, Pune',
      customerType: CustomerType.GARAGE,
      creditLimit: 2000000n, // ₹20,000.00
      paymentTermsDays: 7,
      status: CreditStatus.RED,
      whatsappOptIn: true,
      notes: 'Overdue > 60 days. Blocked for further credit sales without owner signoff.'
    },
    {
      name: 'Imran Khan',
      shopName: 'Star Auto Garage',
      phone: '9822100004',
      address: 'Bhavani Peth, Pune',
      customerType: CustomerType.GARAGE,
      creditLimit: 7500000n, // ₹75,000.00
      paymentTermsDays: 21,
      status: CreditStatus.GREEN,
      whatsappOptIn: true,
      notes: 'High volume buyer, 2-wheeler specialist.'
    },
    {
      name: 'Pravin Gaikwad',
      shopName: 'Gaikwad Two Wheeler Clinic',
      phone: '9822100005',
      address: 'Pimpri Market, PCMC',
      customerType: CustomerType.GARAGE,
      creditLimit: 3000000n, // ₹30,000.00
      paymentTermsDays: 15,
      status: CreditStatus.GREEN,
      whatsappOptIn: true
    },
    {
      name: 'Deepak More',
      shopName: 'Deepak Automobile Spares',
      phone: '9822100006',
      address: 'Chinchwad Station, PCMC',
      gstin: '27CXMPM5566N1Z7',
      customerType: CustomerType.RETAILER,
      creditLimit: 10000000n, // ₹1,00,000.00
      paymentTermsDays: 30,
      status: CreditStatus.GREEN,
      whatsappOptIn: true
    },
    {
      name: 'Sunil Pawar',
      shopName: 'Pawar Service Center',
      phone: '9822100007',
      address: 'Katraj Kondhwa Road, Pune',
      customerType: CustomerType.GARAGE,
      creditLimit: 2500000n, // ₹25,000.00
      paymentTermsDays: 15,
      status: CreditStatus.YELLOW,
      whatsappOptIn: true
    },
    {
      name: 'Vijay Bhosale',
      shopName: 'Bhosale Garage & Alignment',
      phone: '9822100008',
      address: 'Wakad Bridge, PCMC',
      customerType: CustomerType.GARAGE,
      creditLimit: 4000000n, // ₹40,000.00
      paymentTermsDays: 15,
      status: CreditStatus.GREEN,
      whatsappOptIn: true
    },
    {
      name: 'Ganesh Chavan',
      shopName: 'Ganesh Auto Spares & Service',
      phone: '9822100009',
      address: 'Sinhagad Road, Manikbaug, Pune',
      customerType: CustomerType.GARAGE,
      creditLimit: 1500000n, // ₹15,000.00
      paymentTermsDays: 7,
      status: CreditStatus.RED,
      whatsappOptIn: true
    },
    {
      name: 'Akash Salunkhe',
      shopName: 'Salunkhe Motors',
      phone: '9822100010',
      address: 'Viman Nagar, Pune',
      customerType: CustomerType.GARAGE,
      creditLimit: 3000000n, // ₹30,000.00
      paymentTermsDays: 15,
      status: CreditStatus.GREEN,
      whatsappOptIn: true
    }
  ];

  const createdCustomers: any[] = [];
  for (const c of customersData) {
    const cust = await prisma.customer.create({
      data: {
        tenantId: tenant.id,
        name: c.name,
        shopName: c.shopName,
        phone: c.phone,
        address: c.address,
        gstin: c.gstin,
        customerType: c.customerType,
        creditLimit: c.creditLimit,
        paymentTermsDays: c.paymentTermsDays,
        status: c.status,
        whatsappOptIn: c.whatsappOptIn,
        notes: c.notes,
        stateCode: '27'
      }
    });
    createdCustomers.push(cust);
  }
  console.log(`✓ Created ${createdCustomers.length} Customers with Credit Limits & Terms`);

  // 8. Create Sample Invoices, Payments, and Ledger Entries
  // Customer 1 (Ramesh Jadhav): ₹18,400 bill, ₹2,400 paid now, ₹16,000 balance
  const inv1Date = new Date();
  inv1Date.setDate(inv1Date.getDate() - 10);
  const inv1DueDate = new Date(inv1Date);
  inv1DueDate.setDate(inv1DueDate.getDate() + 15);

  const inv1 = await prisma.invoice.create({
    data: {
      tenantId: tenant.id,
      customerId: createdCustomers[0].id,
      invoiceType: InvoiceType.TAX_INVOICE,
      number: 'INV/2026-27/00001',
      seriesCode: 'INV',
      fy: '2026-27',
      status: InvoiceStatus.PARTIALLY_PAID,
      issueDate: inv1Date,
      dueDate: inv1DueDate,
      placeOfSupply: '27-Maharashtra',
      subtotal: 1600000n,       // ₹16,000.00
      discountTotal: 40000n,    // ₹400.00
      taxableValue: 1560000n,   // ₹15,600.00
      cgst: 140400n,            // ₹1,404.00 (9%)
      sgst: 140400n,            // ₹1,404.00 (9%)
      igst: 0n,
      roundOff: -800n,          // -₹8.00
      grandTotal: 1840000n,     // ₹18,400.00
      paidNow: 240000n,         // ₹2,400.00 paid at counter
      amountPaid: 240000n,      // ₹2,400.00
      balanceDue: 1600000n,     // ₹16,000.00
      createdBy: counterStaff.id,
      issuedAt: inv1Date,
      items: {
        create: [
          {
            productId: createdProducts[0].id,
            description: createdProducts[0].name,
            hsnCode: '8714',
            qty: 10,
            unit: 'set',
            rate: 24000n,       // ₹240.00
            discount: 10000n,   // ₹100.00
            taxableValue: 230000n,
            gstRateBp: 1800,
            taxAmount: 41400n,
            lineTotal: 271400n
          },
          {
            productId: createdProducts[2].id,
            description: createdProducts[2].name,
            hsnCode: '8483',
            qty: 8,
            unit: 'kit',
            rate: 99000n,       // ₹990.00
            discount: 30000n,
            taxableValue: 762000n,
            gstRateBp: 1800,
            taxAmount: 137160n,
            lineTotal: 899160n
          },
          {
            productId: createdProducts[5].id,
            description: createdProducts[5].name,
            hsnCode: '2710',
            qty: 15,
            unit: 'can',
            rate: 41000n,       // ₹410.00
            discount: 0n,
            taxableValue: 615000n,
            gstRateBp: 1800,
            taxAmount: 110700n,
            lineTotal: 725700n
          }
        ]
      }
    }
  });

  // Record Ledger Entry for Invoice (Debit: ₹18,400)
  await prisma.ledgerEntry.create({
    data: {
      tenantId: tenant.id,
      customerId: createdCustomers[0].id,
      entryType: LedgerEntryType.INVOICE,
      refId: inv1.id,
      debit: 1840000n,
      credit: 0n,
      entryDate: inv1Date,
      narration: `Invoice ${inv1.number} issued`
    }
  });

  // Record Payment for paidNow (Credit: ₹2,400)
  const p1 = await prisma.payment.create({
    data: {
      tenantId: tenant.id,
      customerId: createdCustomers[0].id,
      amount: 240000n,
      mode: PaymentMode.UPI,
      reference: 'UPI/629103847291',
      receivedOn: inv1Date,
      receivedBy: counterStaff.id,
      notes: 'Counter payment via PhonePe QR'
    }
  });

  await prisma.paymentAllocation.create({
    data: {
      paymentId: p1.id,
      invoiceId: inv1.id,
      amount: 240000n,
      strategy: 'OLDEST_FIRST'
    }
  });

  await prisma.ledgerEntry.create({
    data: {
      tenantId: tenant.id,
      customerId: createdCustomers[0].id,
      entryType: LedgerEntryType.PAYMENT,
      refId: p1.id,
      debit: 0n,
      credit: 240000n,
      entryDate: inv1Date,
      narration: `Payment received (UPI: UPI/629103847291) against ${inv1.number}`
    }
  });

  console.log(`✓ Created Sample Invoice ${inv1.number} with Payment & Ledger Entries`);

  // 9. Create Message Templates (English & Hinglish)
  const templates = [
    {
      key: 'invoice_issued',
      channel: 'WHATSAPP',
      language: 'en',
      body: 'Hello {{name}}, bill {{inv_no}} of ₹{{total}} from {{shop}}. Paid: ₹{{paid}}. Balance: ₹{{balance}}, due {{due_date}}. View: {{link}}'
    },
    {
      key: 'invoice_issued',
      channel: 'WHATSAPP',
      language: 'hi',
      body: 'Namaste {{name}}, {{shop}} se bill {{inv_no}} ₹{{total}} ka. Diya: ₹{{paid}}. Baaki: ₹{{balance}}, {{due_date}} tak. Dekhein: {{link}}'
    },
    {
      key: 'payment_received',
      channel: 'WHATSAPP',
      language: 'en',
      body: 'Thank you {{name}}. We received ₹{{amount}} on {{date}}. Remaining balance: ₹{{balance}}. Statement: {{link}}'
    },
    {
      key: 'payment_received',
      channel: 'WHATSAPP',
      language: 'hi',
      body: 'Dhanyavaad {{name}}. ₹{{amount}} mile ({{date}}). Baaki balance: ₹{{balance}}. Statement: {{link}}'
    },
    {
      key: 'due_soon',
      channel: 'WHATSAPP',
      language: 'en',
      body: 'Hi {{name}}, a gentle reminder: ₹{{balance}} for bill {{inv_no}} is due on {{due_date}}. Pay: {{link}}'
    },
    {
      key: 'due_soon',
      channel: 'WHATSAPP',
      language: 'hi',
      body: '{{name}} ji, yaad dilana tha: bill {{inv_no}} ka ₹{{balance}} {{due_date}} ko dena hai. Payment: {{link}}'
    },
    {
      key: 'due_today',
      channel: 'WHATSAPP',
      language: 'en',
      body: '{{name}}, ₹{{balance}} for bill {{inv_no}} is due today. Pay: {{link}}'
    },
    {
      key: 'due_today',
      channel: 'WHATSAPP',
      language: 'hi',
      body: '{{name}} ji, aaj bill {{inv_no}} ka ₹{{balance}} dena hai. Payment: {{link}}'
    },
    {
      key: 'overdue_soft',
      channel: 'WHATSAPP',
      language: 'en',
      body: '{{name}}, ₹{{balance}} for bill {{inv_no}} was due on {{due_date}}. Please pay or reply with your payment date. {{link}}'
    },
    {
      key: 'overdue_soft',
      channel: 'WHATSAPP',
      language: 'hi',
      body: '{{name}} ji, bill {{inv_no}} ka ₹{{balance}} {{due_date}} ko dena tha. Kripya bhejein ya payment ki date batayein. {{link}}'
    },
    {
      key: 'overdue_firm',
      channel: 'WHATSAPP',
      language: 'hi',
      body: '{{name}} ji, ₹{{balance}} {{days}} din se baaki hai (bill {{inv_no}}). Is hafte clear karein, tabhi aage udhaar chalega. {{link}}'
    },
    {
      key: 'overdue_formal',
      channel: 'WHATSAPP',
      language: 'hi',
      body: '{{name}} ji, ₹{{balance}} {{days}} din se baaki hai. Kripya {{owner_phone}} par baat karke settle karein.'
    }
  ];

  for (const t of templates) {
    await prisma.messageTemplate.create({
      data: {
        tenantId: tenant.id,
        key: t.key,
        channel: t.channel,
        language: t.language,
        body: t.body,
        approvalStatus: 'APPROVED'
      }
    });
  }
  console.log(`✓ Created ${templates.length} Message Templates (English / Hinglish)`);

  // 10. Create Default Reminder Rules
  const reminderRulesData = [
    { name: '3 Days Before Due Date', offsetDays: -3, templateKey: 'due_soon', channels: ['WHATSAPP', 'SMS'], appliesToStatus: ['GREEN', 'YELLOW', 'RED'] },
    { name: 'Due Date Reminder', offsetDays: 0, templateKey: 'due_today', channels: ['WHATSAPP', 'SMS'], appliesToStatus: ['GREEN', 'YELLOW', 'RED'] },
    { name: 'Overdue +3 Days Followup', offsetDays: 3, templateKey: 'overdue_soft', channels: ['WHATSAPP', 'SMS'], appliesToStatus: ['GREEN', 'YELLOW', 'RED'] },
    { name: 'Overdue +7 Days Reminder', offsetDays: 7, templateKey: 'overdue_soft', channels: ['WHATSAPP'], appliesToStatus: ['GREEN', 'YELLOW', 'RED'] },
    { name: 'Overdue +15 Days Firm Warning', offsetDays: 15, templateKey: 'overdue_firm', channels: ['WHATSAPP', 'SMS'], appliesToStatus: ['YELLOW', 'RED'] },
    { name: 'Overdue +30 Days Formal Notice', offsetDays: 30, templateKey: 'overdue_formal', channels: ['WHATSAPP', 'SMS'], appliesToStatus: ['RED'] },
  ];

  for (const r of reminderRulesData) {
    await prisma.reminderRule.create({
      data: {
        tenantId: tenant.id,
        name: r.name,
        offsetDays: r.offsetDays,
        templateKey: r.templateKey,
        channels: r.channels,
        appliesToStatus: r.appliesToStatus,
        minAmount: 10000n // Minimum ₹100.00
      }
    });
  }
  console.log(`✓ Created ${reminderRulesData.length} Reminder Rules`);

  console.log('\n🎉 Database Seed Completed Successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
