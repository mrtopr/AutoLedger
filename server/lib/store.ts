import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

// Local storage path for offline / non-Postgres dev mode
const DATA_DIR = path.join(process.cwd(), '.data');
const STORE_FILE = path.join(DATA_DIR, 'db_store.json');

export interface LocalTenant {
  id: string;
  name: string;
  legalName?: string;
  gstin?: string;
  address?: string;
  stateCode?: string;
  phone?: string;
  email?: string;
  upiId?: string;
  bankDetails?: any;
  settings?: any;
  createdAt: string;
}

export interface LocalUser {
  id: string;
  tenantId: string;
  name: string;
  phone: string;
  email?: string;
  password?: string;
  role: 'OWNER' | 'MANAGER' | 'COUNTER_STAFF';
  isActive: boolean;
  createdAt: string;
}

export interface LocalProduct {
  id: string;
  tenantId: string;
  name: string;
  partNumber?: string;
  brand?: string;
  category?: string;
  subcategory?: string;
  hsnCode: string;
  gstRateBp: number;
  unit: string;
  purchasePricePaise: string;
  salePricePaise: string;
  mrpPaise: string;
  stockQty: number;
  reorderLevel: number;
  models: string[];
  createdAt: string;
}

export interface LocalCustomer {
  id: string;
  tenantId: string;
  name: string;
  shopName: string;
  phone: string;
  address?: string;
  gstin?: string | null;
  customerType: string;
  balancePaise: string;
  creditLimitPaise: string;
  status: string;
  termsDays: number;
  overduePaise: string;
  createdAt: string;
}

export interface LocalLedgerEntry {
  id: string;
  tenantId: string;
  customerId: string;
  date: string;
  type: string;
  refNo: string;
  narration: string;
  debitPaise: string;
  creditPaise: string;
  runningBalancePaise: string;
  createdAt: string;
}

export interface LocalInvoice {
  id: string;
  tenantId: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerGstin?: string;
  invoiceNumber: string;
  number?: number;
  seriesCode?: string;
  fy?: string;
  status?: string;
  cancelReason?: string;
  idempotencyKey?: string;
  grandTotalPaise: string;
  paidNowPaise: string;
  creditBalancePaise: string;
  items: any[];
  createdAt: string;
}

export interface LocalPayment {
  id: string;
  tenantId: string;
  customerId?: string;
  amountPaise: string;
  mode: string;
  referenceNumber: string;
  idempotencyKey?: string;
  createdAt: string;
}

export interface LocalCashSettlement {
  id: string;
  tenantId: string;
  date: string; // YYYY-MM-DD
  openingFloatPaise: string;
  cashSalesPaise: string;
  cashReceiptsPaise: string;
  cashExpensesPaise: string;
  expectedCashPaise: string;
  denominations: Record<string, number>;
  countedCashPaise: string;
  differencePaise: string;
  retainedFloatPaise: string;
  withdrawnPaise: string;
  upiTotalPaise: string;
  bankTotalPaise: string;
  upiVerified: boolean;
  notes?: string;
  status: 'BALANCED' | 'SHORT' | 'EXCESS';
  closedByUserId?: string;
  closedByName?: string;
  createdAt: string;
}

export interface LocalAuditLog {
  id: string;
  tenantId: string;
  userId?: string | null;
  action: string;
  entity: string;
  entityId: string;
  before?: any;
  after?: any;
  ip?: string | null;
  createdAt: string;
}

export interface LocalStoreData {
  tenants: LocalTenant[];
  users: LocalUser[];
  products: LocalProduct[];
  customers: LocalCustomer[];
  ledgerEntries: LocalLedgerEntry[];
  invoices: LocalInvoice[];
  payments: LocalPayment[];
  cashSettlements?: LocalCashSettlement[];
  auditLogs?: LocalAuditLog[];
  paymentAttempts?: Record<string, { status: 'paid' | 'failed' | 'pending'; reason?: string; paymentId?: string; updatedAt: string }>;
  invoiceSeries?: Record<string, { lastNumber: number; prefix: string }>;
  hasSeededProducts?: Record<string, boolean>;
  hasSeededCustomers?: Record<string, boolean>;
}

function getInitialData(): LocalStoreData {
  return {
    tenants: [],
    users: [],
    products: [],
    customers: [],
    ledgerEntries: [],
    invoices: [],
    payments: [],
    cashSettlements: [],
    auditLogs: [],
    paymentAttempts: {},
    hasSeededProducts: {},
    hasSeededCustomers: {},
  };
}

class LocalStore {
  private data: LocalStoreData;

  constructor() {
    this.data = this.load();
  }

  private load(): LocalStoreData {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(STORE_FILE)) {
        const raw = fs.readFileSync(STORE_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        parsed.cashSettlements = parsed.cashSettlements || [];
        return parsed;
      }
    } catch (err) {
      console.warn('Could not read store file, initializing defaults:', err);
    }
    const initial = getInitialData();
    this.save(initial);
    return initial;
  }

  public save(dataToSave?: LocalStoreData) {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(STORE_FILE, JSON.stringify(dataToSave || this.data), 'utf-8');
    } catch (err) {
      console.warn('Could not write to store file:', err);
    }
  }

  public clearAll() {
    this.data = getInitialData();
    this.save();
  }

  // Tenant methods
  createTenant(tenant: Omit<LocalTenant, 'id' | 'createdAt'>): LocalTenant {
    const newTenant: LocalTenant = {
      ...tenant,
      id: `tenant-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    this.data.tenants.push(newTenant);
    this.save();
    return newTenant;
  }

  getTenants(): LocalTenant[] {
    return this.data.tenants;
  }

  getTenant(id?: string): LocalTenant | undefined {
    if (id) {
      return this.getTenantById(id) || this.data.tenants[0];
    }
    return this.data.tenants[0];
  }

  getTenantById(id: string): LocalTenant | undefined {
    return this.data.tenants.find((t) => t.id === id);
  }

  updateTenant(id: string, updates: Partial<LocalTenant>): LocalTenant | null {
    let idx = this.data.tenants.findIndex((t) => t.id === id);
    if (idx === -1) {
      if (this.data.tenants.length > 0) {
        idx = 0;
      } else {
        const created = this.createTenant({
          name: updates.name || 'Honda Dealership',
          ...updates,
        });
        return created;
      }
    }
    this.data.tenants[idx] = {
      ...this.data.tenants[idx],
      ...updates,
      bankDetails: updates.bankDetails !== undefined ? updates.bankDetails : this.data.tenants[idx].bankDetails,
      settings: updates.settings !== undefined ? updates.settings : this.data.tenants[idx].settings,
    };
    this.save();
    return this.data.tenants[idx];
  }

  // User methods
  createUser(user: Omit<LocalUser, 'id' | 'createdAt'>): LocalUser {
    const newUser: LocalUser = {
      ...user,
      id: `user-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    this.data.users.push(newUser);
    this.save();
    return newUser;
  }

  getUsers(tenantId?: string): LocalUser[] {
    if (tenantId) {
      return this.data.users.filter((u) => u.tenantId === tenantId);
    }
    return this.data.users;
  }

  findUser(loginId: string): (LocalUser & { tenant?: LocalTenant }) | null {
    const clean = loginId.trim();
    const clean10 = clean.replace(/[^0-9]/g, '').slice(-10);
    const user = this.data.users.find(
      (u) => {
        const uPhone10 = u.phone ? u.phone.replace(/[^0-9]/g, '').slice(-10) : '';
        return (
          u.phone === clean ||
          (clean10.length === 10 && uPhone10 === clean10) ||
          (u.email && u.email.toLowerCase() === clean.toLowerCase())
        );
      }
    );
    if (!user) return null;
    const tenant = this.getTenantById(user.tenantId);
    return { ...user, tenant };
  }

  findUserById(id: string): (LocalUser & { tenant?: LocalTenant }) | null {
    const user = this.data.users.find((u) => u.id === id);
    if (!user) return null;
    const tenant = this.getTenantById(user.tenantId);
    return { ...user, tenant };
  }

  updateUser(id: string, updates: Partial<LocalUser>, tenantId?: string): LocalUser | null {
    const idx = this.data.users.findIndex((u) => u.id === id && (!tenantId || u.tenantId === tenantId));
    if (idx === -1) return null;
    this.data.users[idx] = { ...this.data.users[idx], ...updates };
    this.save();
    return this.data.users[idx];
  }

  // Product methods
  getProducts(tenantId?: string): LocalProduct[] {
    if (tenantId) {
      const filtered = this.data.products.filter((p) => p.tenantId === tenantId);
      if (filtered.length > 0) {
        return filtered;
      }

      this.data.hasSeededProducts = this.data.hasSeededProducts || {};
      if (this.data.hasSeededProducts[tenantId]) {
        return [];
      }

      this.data.hasSeededProducts[tenantId] = true;
      this.save();

      // Seed starter catalog products if tenant is empty
      const defaultProducts = [
        {
          name: 'Motul 4T Plus 10W-30 Engine Oil (900ml)',
          partNumber: 'OIL-MOT-10W30',
          brand: 'Motul',
          category: 'Lubricants & Fluids',
          hsnCode: '2710',
          gstRateBp: 1800,
          unit: 'can',
          purchasePricePaise: '26500',
          salePricePaise: '36000',
          mrpPaise: '42000',
          stockQty: 48,
          reorderLevel: 10,
          models: ['Honda Activa', 'Hero Splendor', 'Bajaj Pulsar', 'Universal'],
          tenantId,
        },
        {
          name: 'Front Brake Shoe Set (Asbestos Free)',
          partNumber: 'BRK-SH-FR01',
          brand: 'KBX / Bosch',
          category: 'Brakes & Friction',
          hsnCode: '8714',
          gstRateBp: 1800,
          unit: 'set',
          purchasePricePaise: '14500',
          salePricePaise: '24000',
          mrpPaise: '29000',
          stockQty: 32,
          reorderLevel: 8,
          models: ['Hero Splendor Plus', 'HF Deluxe', 'Passion Pro'],
          tenantId,
        },
        {
          name: 'NGK Spark Plug CPR8EA-9',
          partNumber: 'SPK-NGK-CPR8',
          brand: 'NGK',
          category: 'Electrical & Ignition',
          hsnCode: '8511',
          gstRateBp: 1800,
          unit: 'pcs',
          purchasePricePaise: '7500',
          salePricePaise: '13500',
          mrpPaise: '16000',
          stockQty: 85,
          reorderLevel: 15,
          models: ['Honda Activa 3G/4G/5G/6G', 'Honda Shine'],
          tenantId,
        },
        {
          name: 'Heavy Duty Rolon Chain Sprocket Kit',
          partNumber: 'CHN-RLN-041',
          brand: 'Rolon',
          category: 'Transmission & Drive',
          hsnCode: '8714',
          gstRateBp: 1800,
          unit: 'kit',
          purchasePricePaise: '62000',
          salePricePaise: '89000',
          mrpPaise: '105000',
          stockQty: 18,
          reorderLevel: 5,
          models: ['Bajaj Pulsar 150/180', 'Discover 125'],
          tenantId,
        },
        {
          name: 'High Flow Air Filter Element',
          partNumber: 'FLT-AIR-ACT6',
          brand: 'Purolator',
          category: 'Filters & Intake',
          hsnCode: '8421',
          gstRateBp: 1800,
          unit: 'pcs',
          purchasePricePaise: '9500',
          salePricePaise: '18000',
          mrpPaise: '22000',
          stockQty: 40,
          reorderLevel: 10,
          models: ['Honda Activa 6G', 'Dio BS6'],
          tenantId,
        }
      ];

      for (const p of defaultProducts) {
        this.createProduct(p);
      }
      return this.data.products.filter((p) => p.tenantId === tenantId);
    }
    return this.data.products;
  }

  createProduct(product: Omit<LocalProduct, 'id' | 'createdAt'> & { id?: string }): LocalProduct {
    const newProduct: LocalProduct = {
      ...product,
      id: product.id || `p-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      createdAt: new Date().toISOString(),
    };
    this.data.products.unshift(newProduct);
    this.save();
    return newProduct;
  }

  getProductById(id: string, tenantId?: string): LocalProduct | undefined {
    return this.data.products.find((prod) => prod.id === id && (!tenantId || prod.tenantId === tenantId));
  }

  adjustProductStock(id: string, deltaQty: number, tenantId?: string): LocalProduct | null {
    const p = this.data.products.find((prod) => prod.id === id && (!tenantId || prod.tenantId === tenantId));
    if (!p) return null;
    p.stockQty += deltaQty;
    this.save();
    return p;
  }

  updateProduct(id: string, updates: Partial<LocalProduct>, tenantId?: string): LocalProduct | null {
    const idx = this.data.products.findIndex((prod) => prod.id === id && (!tenantId || prod.tenantId === tenantId));
    if (idx === -1) return null;
    this.data.products[idx] = { ...this.data.products[idx], ...updates };
    this.save();
    return this.data.products[idx];
  }

  bulkUpsertProducts(
    tenantId: string,
    items: Array<{
      name: string;
      partNumber?: string;
      brand?: string;
      category?: string;
      subcategory?: string;
      hsnCode?: string;
      gstRateBp?: number;
      unit?: string;
      purchasePricePaise?: string;
      salePricePaise?: string;
      mrpPaise?: string;
      stockQty?: number;
      reorderLevel?: number;
      models?: string[];
      existingProductId?: string;
      syncAction?: 'CREATE' | 'UPDATE' | 'SKIP';
      isUnpriced?: boolean;
    }>
  ): { importedCount: number; updatedCount: number; skippedCount: number } {
    const existingById = new Map<string, LocalProduct>();
    const existingByName = new Map<string, LocalProduct>();

    for (const p of this.data.products) {
      if (p.tenantId === tenantId) {
        existingById.set(p.id, p);
        if (p.name) {
          existingByName.set(p.name.trim().toLowerCase(), p);
        }
      }
    }

    let importedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const nowIso = new Date().toISOString();

    for (const item of items) {
      const trimmedName = (item.name || '').trim();
      if (!trimmedName || item.syncAction === 'SKIP') {
        skippedCount++;
        continue;
      }

      const existing = (item.existingProductId ? existingById.get(item.existingProductId) : null) ||
        existingByName.get(trimmedName.toLowerCase());

      if (existing) {
        if (item.salePricePaise !== undefined) existing.salePricePaise = item.salePricePaise;
        if (item.purchasePricePaise !== undefined) existing.purchasePricePaise = item.purchasePricePaise;
        if (item.mrpPaise !== undefined) existing.mrpPaise = item.mrpPaise;
        if (item.brand) existing.brand = item.brand;
        if (item.category) existing.category = item.category;
        if (item.subcategory) existing.subcategory = item.subcategory;
        if (item.models && item.models.length > 0) existing.models = item.models;
        if (item.stockQty !== undefined && !item.isUnpriced) existing.stockQty = item.stockQty;
        updatedCount++;
      } else {
        const newProduct: LocalProduct = {
          id: `p-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          tenantId,
          name: trimmedName,
          partNumber: item.partNumber || `SKU-${Date.now().toString(36).toUpperCase()}`,
          brand: item.brand || 'Standard',
          category: item.category || 'General Automobile Spares',
          subcategory: item.subcategory || 'Spare Parts',
          hsnCode: item.hsnCode || '8714',
          gstRateBp: item.gstRateBp || 1800,
          unit: item.unit || 'pcs',
          purchasePricePaise: item.purchasePricePaise || '0',
          salePricePaise: item.salePricePaise || '0',
          mrpPaise: item.mrpPaise || '0',
          stockQty: item.stockQty || 0,
          reorderLevel: item.reorderLevel || 5,
          models: item.models || ['Universal / Multi-Fit'],
          createdAt: nowIso,
        };
        this.data.products.push(newProduct);
        existingById.set(newProduct.id, newProduct);
        existingByName.set(newProduct.name.toLowerCase(), newProduct);
        importedCount++;
      }
    }

    // Save to disk ONCE after entire batch is processed in memory
    this.save();

    return { importedCount, updatedCount, skippedCount };
  }

  upsertProduct(id: string, updates: Partial<LocalProduct>): LocalProduct {
    const idx = this.data.products.findIndex((prod) => prod.id === id);
    if (idx === -1) {
      const newProd: LocalProduct = {
        id,
        tenantId: updates.tenantId || 'tenant-honda-1',
        name: updates.name || 'Spare Part',
        partNumber: updates.partNumber,
        brand: updates.brand,
        category: updates.category,
        hsnCode: updates.hsnCode || '8714',
        gstRateBp: updates.gstRateBp || 1800,
        unit: updates.unit || 'pcs',
        purchasePricePaise: updates.purchasePricePaise || '0',
        salePricePaise: updates.salePricePaise || '0',
        mrpPaise: updates.mrpPaise || '0',
        stockQty: updates.stockQty || 0,
        reorderLevel: updates.reorderLevel || 5,
        models: updates.models || ['Universal / Multi-Fit'],
        createdAt: new Date().toISOString(),
      };
      this.data.products.unshift(newProd);
      this.save();
      return newProd;
    }
    this.data.products[idx] = { ...this.data.products[idx], ...updates };
    this.save();
    return this.data.products[idx];
  }

  deleteProduct(id: string, tenantId?: string): boolean {
    const beforeLen = this.data.products.length;
    this.data.products = this.data.products.filter((prod) => !(prod.id === id && (!tenantId || prod.tenantId === tenantId)));
    if (this.data.products.length !== beforeLen) {
      this.save();
      return true;
    }
    return false;
  }

  deleteProducts(ids: string[], tenantId?: string): number {
    const idSet = new Set(ids);
    const beforeLen = this.data.products.length;
    this.data.products = this.data.products.filter((prod) => !(idSet.has(prod.id) && (!tenantId || prod.tenantId === tenantId)));
    const deletedCount = beforeLen - this.data.products.length;
    if (deletedCount > 0) {
      this.save();
    }
    return deletedCount;
  }

  deleteProductsByFilter(
    tenantId?: string,
    options?: { category?: string; brand?: string; zeroStockOnly?: boolean; search?: string; all?: boolean }
  ): number {
    const beforeLen = this.data.products.length;
    this.data.products = this.data.products.filter((prod) => {
      if (tenantId && prod.tenantId !== tenantId) return true; // keep other tenants
      if (options?.all) return false; // delete all for this tenant

      let matches = true;
      if (options?.category && options.category !== 'All Departments') {
        matches = matches && prod.category === options.category;
      }
      if (options?.brand) {
        matches = matches && prod.brand === options.brand;
      }
      if (options?.zeroStockOnly) {
        matches = matches && prod.stockQty <= 0;
      }
      if (options?.search) {
        const q = options.search.toLowerCase();
        matches = matches && Boolean(
          prod.name.toLowerCase().includes(q) ||
          (prod.partNumber && prod.partNumber.toLowerCase().includes(q)) ||
          (prod.brand && prod.brand.toLowerCase().includes(q))
        );
      }
      return !matches; // if it matched filter criteria, remove it
    });

    const deletedCount = beforeLen - this.data.products.length;
    if (deletedCount > 0) {
      this.save();
    }
    return deletedCount;
  }

  // Customer methods
  getCustomers(tenantId?: string): LocalCustomer[] {
    if (tenantId) {
      const filtered = this.data.customers.filter((c) => c.tenantId === tenantId);

      this.data.hasSeededCustomers = this.data.hasSeededCustomers || {};
      if (filtered.length > 0 || this.data.hasSeededCustomers[tenantId]) {
        return filtered;
      }

      this.data.hasSeededCustomers[tenantId] = true;
      this.save();

      // Seed starter B2B customers for this tenant
      const defaultCustomers = [
        {
          name: 'Ramesh Sharma',
          shopName: 'Sharma General Trade & Supplies',
          phone: '9822100001',
          address: 'Shop 4, Main Commercial Market, Pune',
          gstin: '27AABCS1429B1Z1',
          customerType: 'RETAILER',
          balancePaise: '1450000',
          creditLimitPaise: '5000000',
          status: 'GREEN',
          termsDays: 15,
          overduePaise: '0',
          tenantId,
        },
        {
          name: 'Sunil Verma',
          shopName: 'Verma Wholesale Enterprises',
          phone: '9822100002',
          address: 'Plot 12, Industrial Area, Mumbai',
          gstin: '27AABCV8912C1Z2',
          customerType: 'DISTRIBUTOR',
          balancePaise: '3200000',
          creditLimitPaise: '7500000',
          status: 'GREEN',
          termsDays: 20,
          overduePaise: '0',
          tenantId,
        },
        {
          name: 'Imran Khan',
          shopName: 'Star Retail Store & Distribution',
          phone: '9822100003',
          address: 'Station Road, Near Trade Hub',
          gstin: null,
          customerType: 'RETAILER',
          balancePaise: '850000',
          creditLimitPaise: '3000000',
          status: 'YELLOW',
          termsDays: 10,
          overduePaise: '250000',
          tenantId,
        }
      ];

      for (const c of defaultCustomers) {
        this.createCustomer(c);
      }
      return this.data.customers.filter((c) => c.tenantId === tenantId);
    }
    return this.data.customers;
  }

  getCustomerById(id: string, tenantId?: string): LocalCustomer | undefined {
    return this.data.customers.find((c) => c.id === id && (!tenantId || c.tenantId === tenantId));
  }

  getCustomerByPhone(phone: string, tenantId?: string): LocalCustomer | undefined {
    const clean = phone.replace(/[^0-9]/g, '').slice(-10);
    if (!clean) return undefined;
    return this.data.customers.find((c) => {
      const cClean = (c.phone || '').replace(/[^0-9]/g, '').slice(-10);
      return cClean === clean && (!tenantId || c.tenantId === tenantId);
    });
  }

  createCustomer(customer: Omit<LocalCustomer, 'id' | 'createdAt'> & { id?: string }): LocalCustomer {
    const newCustomer: LocalCustomer = {
      ...customer,
      id: customer.id || `cust-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    this.data.customers.unshift(newCustomer);
    this.save();
    return newCustomer;
  }

  updateCustomer(id: string, updates: Partial<LocalCustomer>, tenantId?: string): LocalCustomer | null {
    const idx = this.data.customers.findIndex((c) => c.id === id && (!tenantId || c.tenantId === tenantId));
    if (idx === -1) return null;
    this.data.customers[idx] = { ...this.data.customers[idx], ...updates };
    this.save();
    return this.data.customers[idx];
  }

  upsertCustomer(id: string, updates: Partial<LocalCustomer>): LocalCustomer {
    const idx = this.data.customers.findIndex((c) => c.id === id);
    if (idx === -1) {
      const newCust: LocalCustomer = {
        id,
        tenantId: updates.tenantId || 'tenant-honda-1',
        name: updates.name || updates.shopName || 'Customer',
        shopName: updates.shopName || updates.name || 'Customer',
        phone: updates.phone || '',
        address: updates.address || '',
        gstin: updates.gstin,
        customerType: updates.customerType || 'GARAGE',
        balancePaise: updates.balancePaise || '0',
        creditLimitPaise: updates.creditLimitPaise || '5000000',
        status: updates.status || 'GREEN',
        termsDays: updates.termsDays || 15,
        overduePaise: '0',
        createdAt: new Date().toISOString(),
      };
      this.data.customers.unshift(newCust);
      this.save();
      return newCust;
    }
    this.data.customers[idx] = { ...this.data.customers[idx], ...updates };
    this.save();
    return this.data.customers[idx];
  }

  deleteCustomer(id: string, tenantId?: string): boolean {
    const beforeLen = this.data.customers.length;
    this.data.customers = this.data.customers.filter((c) => !(c.id === id && (!tenantId || c.tenantId === tenantId)));
    if (this.data.customers.length !== beforeLen) {
      this.save();
      return true;
    }
    return false;
  }

  // Ledger & Invoices
  getLedger(customerId: string, tenantId?: string): LocalLedgerEntry[] {
    const entries = this.data.ledgerEntries
      .filter((l) => l.customerId === customerId && (!tenantId || l.tenantId === tenantId))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    let running = 0n;
    const withRunning = entries.map((entry) => {
      const d = BigInt(entry.debitPaise || 0);
      const c = BigInt(entry.creditPaise || 0);
      running = running + d - c;
      return {
        ...entry,
        date: entry.date || entry.createdAt.split('T')[0],
        runningBalancePaise: running.toString(),
      };
    });

    return withRunning.reverse();
  }

  addLedgerEntry(entry: Omit<LocalLedgerEntry, 'id' | 'createdAt' | 'runningBalancePaise' | 'date'> & { date?: string; createdAt?: string }): LocalLedgerEntry {
    const entryCreatedAt = entry.createdAt || new Date().toISOString();
    const newEntry: LocalLedgerEntry = {
      ...entry,
      id: `led-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      date: entry.date || entryCreatedAt.split('T')[0],
      runningBalancePaise: '0',
      createdAt: entryCreatedAt,
    };
    this.data.ledgerEntries.unshift(newEntry);

    // Update customer balance & credit health status
    const cust = this.getCustomerById(entry.customerId);
    if (cust) {
      const current = BigInt(cust.balancePaise || 0);
      const debit = BigInt(entry.debitPaise || 0);
      const credit = BigInt(entry.creditPaise || 0);
      const newBal = current + debit - credit;
      cust.balancePaise = newBal.toString();
      const limit = BigInt(cust.creditLimitPaise || 5000000);
      cust.status = newBal <= limit ? 'GREEN' : 'YELLOW';
    }

    this.save();
    return newEntry;
  }

  getNextInvoiceNumber(
    tenantId: string,
    seriesCode: string = 'INV',
    fy: string,
    prefix?: string,
    padLength: number = 5
  ): { invoiceNumber: string; seriesCode: string; fy: string; sequenceNumber: number } {
    this.data.invoiceSeries = this.data.invoiceSeries || {};
    const effectivePrefix = prefix || `${seriesCode}/${fy}/`;
    const key = `${tenantId}:${seriesCode}:${fy}`;

    if (!this.data.invoiceSeries[key]) {
      // Find highest existing invoice number for this tenant & prefix in legacy records
      let maxNum = 0;
      for (const inv of this.data.invoices) {
        if (inv.tenantId === tenantId && inv.invoiceNumber && inv.invoiceNumber.startsWith(effectivePrefix)) {
          const suffix = inv.invoiceNumber.slice(effectivePrefix.length);
          const parsed = parseInt(suffix, 10);
          if (!isNaN(parsed) && parsed > maxNum) {
            maxNum = parsed;
          }
        }
      }
      this.data.invoiceSeries[key] = {
        lastNumber: maxNum,
        prefix: effectivePrefix,
      };
    }

    const series = this.data.invoiceSeries[key];
    series.lastNumber += 1;
    this.save();

    const formatted = `${series.prefix}${String(series.lastNumber).padStart(padLength, '0')}`;
    return {
      invoiceNumber: formatted,
      seriesCode,
      fy,
      sequenceNumber: series.lastNumber,
    };
  }

  createInvoice(invoice: Omit<LocalInvoice, 'id' | 'createdAt'> & { createdAt?: string }): LocalInvoice {
    const newInvoice: LocalInvoice = {
      ...invoice,
      id: `inv-${Date.now()}`,
      status: invoice.status || 'ISSUED',
      createdAt: invoice.createdAt || new Date().toISOString(),
    };
    this.data.invoices.unshift(newInvoice);

    // Decrement product stock with exact validated quantity (only for confirmed bills, not DRAFT requisitions)
    if (newInvoice.status !== 'DRAFT') {
      for (const item of invoice.items) {
        if (item.productId) {
          this.adjustProductStock(item.productId, -(Number(item.qty) || 1), invoice.tenantId);
        }
      }
    }

    this.save();
    return newInvoice;
  }

  getInvoiceById(id: string, tenantId?: string): LocalInvoice | undefined {
    return this.data.invoices.find((i) => (i.id === id || i.invoiceNumber === id) && (!tenantId || i.tenantId === tenantId));
  }

  getInvoiceByIdempotencyKey(tenantId: string, idempotencyKey: string): LocalInvoice | undefined {
    return this.data.invoices.find((i) => i.tenantId === tenantId && i.idempotencyKey === idempotencyKey);
  }

  cancelInvoice(id: string, reason?: string, tenantId?: string): LocalInvoice | null {
    const inv = this.data.invoices.find((i) => (i.id === id || i.invoiceNumber === id) && (!tenantId || i.tenantId === tenantId));
    if (!inv) return null;
    if (inv.status === 'CANCELLED') return inv;

    const previousStatus = inv.status;
    inv.status = 'CANCELLED';
    inv.cancelReason = reason || 'Customer / Billing cancellation';
    inv.creditBalancePaise = '0';

    // 1. Restore product stock only if invoice was previously confirmed (not DRAFT)
    if (previousStatus !== 'DRAFT' && inv.items && Array.isArray(inv.items)) {
      for (const item of inv.items) {
        if (item.productId) {
          this.adjustProductStock(item.productId, item.qty || 1, inv.tenantId);
        }
      }
    }

    // 2. Reverse Khata balance if customer linked and invoice was previously confirmed (not DRAFT)
    if (previousStatus !== 'DRAFT' && inv.customerId) {
      this.addLedgerEntry({
        tenantId: inv.tenantId,
        customerId: inv.customerId,
        type: 'ADJUSTMENT',
        refNo: inv.invoiceNumber,
        narration: `Reversal - Cancelled Invoice #${inv.invoiceNumber} (${inv.cancelReason})`,
        debitPaise: '0',
        creditPaise: inv.grandTotalPaise,
      });
    }

    this.save();
    return inv;
  }

  getInvoices(tenantId?: string): LocalInvoice[] {
    if (tenantId) {
      return this.data.invoices.filter((i) => i.tenantId === tenantId);
    }
    return this.data.invoices;
  }

  getPayments(tenantId?: string): LocalPayment[] {
    if (tenantId) {
      return this.data.payments.filter((p) => p.tenantId === tenantId);
    }
    return this.data.payments;
  }

  getPaymentByIdempotencyKey(tenantId: string, idempotencyKey: string): LocalPayment | undefined {
    return this.data.payments.find((p) => p.tenantId === tenantId && p.idempotencyKey === idempotencyKey);
  }

  createPayment(payment: Omit<LocalPayment, 'id' | 'createdAt'> & { createdAt?: string }): LocalPayment {
    const newPayment: LocalPayment = {
      ...payment,
      id: `pay-${Date.now()}`,
      createdAt: payment.createdAt || new Date().toISOString(),
    };
    this.data.payments.unshift(newPayment);
    this.save();
    return newPayment;
  }

  recordPaymentAttempt(linkId: string, attempt: { status: 'paid' | 'failed' | 'pending'; reason?: string; paymentId?: string }) {
    if (!this.data.paymentAttempts) {
      this.data.paymentAttempts = {};
    }
    this.data.paymentAttempts[linkId] = {
      ...attempt,
      updatedAt: new Date().toISOString(),
    };
    this.save();
  }

  getPaymentAttempt(linkId: string) {
    if (!this.data.paymentAttempts) return null;
    return this.data.paymentAttempts[linkId] || null;
  }

  // Cash Settlements (Day-End Till Reconciliation)
  getCashSettlements(tenantId?: string): LocalCashSettlement[] {
    this.data.cashSettlements = this.data.cashSettlements || [];
    if (tenantId) {
      return this.data.cashSettlements.filter((s) => s.tenantId === tenantId);
    }
    return this.data.cashSettlements;
  }

  getLatestCashSettlement(tenantId?: string): LocalCashSettlement | null {
    const list = this.getCashSettlements(tenantId);
    if (!list || list.length === 0) return null;
    return [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  }

  getCashSettlementByDate(date: string, tenantId?: string): LocalCashSettlement | null {
    const list = this.getCashSettlements(tenantId);
    return list.find((s) => s.date === date) || null;
  }

  saveCashSettlement(settlement: Omit<LocalCashSettlement, 'id' | 'createdAt'>): LocalCashSettlement {
    this.data.cashSettlements = this.data.cashSettlements || [];
    const existingIdx = this.data.cashSettlements.findIndex(
      (s) => s.tenantId === settlement.tenantId && s.date === settlement.date
    );

    const newRecord: LocalCashSettlement = {
      ...settlement,
      id: existingIdx >= 0 ? this.data.cashSettlements[existingIdx].id : `settle-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    if (existingIdx >= 0) {
      this.data.cashSettlements[existingIdx] = newRecord;
    } else {
      this.data.cashSettlements.unshift(newRecord);
    }
    this.save();
    return newRecord;
  }
  deleteCashSettlement(idOrDate: string, tenantId?: string): boolean {
    this.data.cashSettlements = this.data.cashSettlements || [];
    const beforeLen = this.data.cashSettlements.length;
    this.data.cashSettlements = this.data.cashSettlements.filter((s) => {
      const match = (s.id === idOrDate || s.date === idOrDate);
      if (tenantId) {
        return !(match && s.tenantId === tenantId);
      }
      return !match;
    });
    const deleted = beforeLen > this.data.cashSettlements.length;
    if (deleted) {
      this.save();
    }
    return deleted;
  }

  addAuditLog(entry: Omit<LocalAuditLog, 'id' | 'createdAt'>): LocalAuditLog {
    if (!this.data.auditLogs) {
      this.data.auditLogs = [];
    }
    const log: LocalAuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      ...entry,
      createdAt: new Date().toISOString(),
    };
    this.data.auditLogs.unshift(log);
    if (this.data.auditLogs.length > 10000) {
      this.data.auditLogs.length = 10000;
    }
    this.save();
    return log;
  }

  getAuditLogs(tenantId: string): LocalAuditLog[] {
    if (!this.data.auditLogs) return [];
    return this.data.auditLogs.filter((l) => l.tenantId === tenantId);
  }
}

// Global singleton instance
const globalStore = globalThis as unknown as { _localStore?: LocalStore };

if (
  !globalStore._localStore ||
  typeof globalStore._localStore.cancelInvoice !== 'function' ||
  typeof globalStore._localStore.getCustomerByPhone !== 'function' ||
  typeof globalStore._localStore.getTenant !== 'function' ||
  typeof globalStore._localStore.saveCashSettlement !== 'function' ||
  typeof globalStore._localStore.deleteCashSettlement !== 'function'
) {
  globalStore._localStore = new LocalStore();
} else {
  // Ensure prototype methods are up-to-date across hot module reloads
  Object.setPrototypeOf(globalStore._localStore, LocalStore.prototype);
}

export const localStore: LocalStore = globalStore._localStore;

