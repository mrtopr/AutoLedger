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
  invoiceNumber: string;
  grandTotalPaise: string;
  paidNowPaise: string;
  creditBalancePaise: string;
  items: any[];
  createdAt: string;
}

export interface LocalPayment {
  id: string;
  tenantId: string;
  customerId: string;
  amountPaise: string;
  mode: string;
  referenceNumber: string;
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
  paymentAttempts?: Record<string, { status: 'paid' | 'failed' | 'pending'; reason?: string; paymentId?: string; updatedAt: string }>;
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
    paymentAttempts: {},
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
        return JSON.parse(raw);
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
      fs.writeFileSync(STORE_FILE, JSON.stringify(dataToSave || this.data, null, 2), 'utf-8');
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
    const user = this.data.users.find(
      (u) => u.phone === clean || (u.email && u.email.toLowerCase() === clean.toLowerCase())
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

  updateUser(id: string, updates: Partial<LocalUser>): LocalUser | null {
    const idx = this.data.users.findIndex((u) => u.id === id);
    if (idx === -1) return null;
    this.data.users[idx] = { ...this.data.users[idx], ...updates };
    this.save();
    return this.data.users[idx];
  }

  // Product methods
  getProducts(tenantId?: string): LocalProduct[] {
    if (tenantId) {
      const filtered = this.data.products.filter((p) => p.tenantId === tenantId);
      if (filtered.length > 0) return filtered;

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

  createProduct(product: Omit<LocalProduct, 'id' | 'createdAt'>): LocalProduct {
    const newProduct: LocalProduct = {
      ...product,
      id: `p-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      createdAt: new Date().toISOString(),
    };
    this.data.products.unshift(newProduct);
    this.save();
    return newProduct;
  }

  adjustProductStock(id: string, deltaQty: number): LocalProduct | null {
    const p = this.data.products.find((prod) => prod.id === id);
    if (!p) return null;
    p.stockQty += deltaQty;
    this.save();
    return p;
  }

  updateProduct(id: string, updates: Partial<LocalProduct>): LocalProduct | null {
    const idx = this.data.products.findIndex((prod) => prod.id === id);
    if (idx === -1) return null;
    this.data.products[idx] = { ...this.data.products[idx], ...updates };
    this.save();
    return this.data.products[idx];
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

  deleteProduct(id: string): boolean {
    const beforeLen = this.data.products.length;
    this.data.products = this.data.products.filter((prod) => prod.id !== id);
    if (this.data.products.length !== beforeLen) {
      this.save();
      return true;
    }
    return false;
  }

  // Customer methods
  getCustomers(tenantId?: string): LocalCustomer[] {
    if (tenantId) {
      const filtered = this.data.customers.filter((c) => c.tenantId === tenantId);
      if (filtered.length > 0) return filtered;

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

  getCustomerById(id: string): LocalCustomer | undefined {
    return this.data.customers.find((c) => c.id === id);
  }

  getCustomerByPhone(phone: string): LocalCustomer | undefined {
    const clean = phone.replace(/[^0-9]/g, '').slice(-10);
    if (!clean) return undefined;
    return this.data.customers.find((c) => {
      const cClean = (c.phone || '').replace(/[^0-9]/g, '').slice(-10);
      return cClean === clean;
    });
  }

  createCustomer(customer: Omit<LocalCustomer, 'id' | 'createdAt'>): LocalCustomer {
    const newCustomer: LocalCustomer = {
      ...customer,
      id: `cust-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    this.data.customers.unshift(newCustomer);
    this.save();
    return newCustomer;
  }

  updateCustomer(id: string, updates: Partial<LocalCustomer>): LocalCustomer | null {
    const idx = this.data.customers.findIndex((c) => c.id === id);
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

  deleteCustomer(id: string): boolean {
    const beforeLen = this.data.customers.length;
    this.data.customers = this.data.customers.filter((c) => c.id !== id);
    if (this.data.customers.length !== beforeLen) {
      this.save();
      return true;
    }
    return false;
  }

  // Ledger & Invoices
  getLedger(customerId: string): LocalLedgerEntry[] {
    const entries = this.data.ledgerEntries
      .filter((l) => l.customerId === customerId)
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

  addLedgerEntry(entry: Omit<LocalLedgerEntry, 'id' | 'createdAt' | 'runningBalancePaise' | 'date'> & { date?: string }): LocalLedgerEntry {
    const newEntry: LocalLedgerEntry = {
      ...entry,
      id: `led-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      date: entry.date || new Date().toISOString().split('T')[0],
      runningBalancePaise: '0',
      createdAt: new Date().toISOString(),
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

  createInvoice(invoice: Omit<LocalInvoice, 'id' | 'createdAt'>): LocalInvoice {
    const newInvoice: LocalInvoice = {
      ...invoice,
      id: `inv-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    this.data.invoices.unshift(newInvoice);

    // Decrement product stock
    for (const item of invoice.items) {
      if (item.productId) {
        this.adjustProductStock(item.productId, -(item.qty || 1));
      }
    }

    this.save();
    return newInvoice;
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

  createPayment(payment: Omit<LocalPayment, 'id' | 'createdAt'>): LocalPayment {
    const newPayment: LocalPayment = {
      ...payment,
      id: `pay-${Date.now()}`,
      createdAt: new Date().toISOString(),
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
}

// Global singleton instance
const globalStore = globalThis as unknown as { _localStore?: LocalStore };

if (
  !globalStore._localStore ||
  typeof globalStore._localStore.getCustomerByPhone !== 'function' ||
  typeof globalStore._localStore.getTenant !== 'function'
) {
  globalStore._localStore = new LocalStore();
}

export const localStore: LocalStore = globalStore._localStore;

