-- 03_DATA_MODEL.sql: reference schema (PostgreSQL). Translate into prisma/schema.prisma.
-- All money columns are BIGINT paise. All tables carry tenant_id and created_at/updated_at.

CREATE TABLE tenants (
  id UUID PRIMARY KEY, name TEXT NOT NULL, gstin TEXT, legal_name TEXT, address TEXT,
  state_code TEXT, logo_url TEXT, upi_id TEXT, bank_details JSONB,
  settings JSONB DEFAULT '{}',          -- reminder rules, credit policy (warn|block), default terms
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE users (
  id UUID PRIMARY KEY, tenant_id UUID REFERENCES tenants, name TEXT, phone TEXT UNIQUE, email TEXT,
  role TEXT CHECK (role IN ('OWNER','MANAGER','COUNTER_STAFF')), totp_secret TEXT, is_active BOOLEAN DEFAULT true
);

CREATE TABLE customers (
  id UUID PRIMARY KEY, tenant_id UUID NOT NULL, name TEXT NOT NULL, shop_name TEXT, phone TEXT,
  whatsapp_opt_in BOOLEAN DEFAULT false, sms_opt_in BOOLEAN DEFAULT true, opted_out_at TIMESTAMPTZ,
  address TEXT, state_code TEXT, gstin TEXT, customer_type TEXT DEFAULT 'GARAGE',
  credit_limit BIGINT DEFAULT 0, payment_terms_days INT DEFAULT 15,
  status TEXT DEFAULT 'GREEN', status_override TEXT, status_override_reason TEXT,
  photo_url TEXT, notes TEXT, is_walk_in BOOLEAN DEFAULT false, is_active BOOLEAN DEFAULT true,
  UNIQUE (tenant_id, phone)
);

CREATE TABLE products (
  id UUID PRIMARY KEY, tenant_id UUID NOT NULL, name TEXT NOT NULL, part_number TEXT, brand TEXT,
  category TEXT, hsn_code TEXT, gst_rate_bp INT DEFAULT 1800,   -- basis points: 1800 = 18%
  unit TEXT DEFAULT 'pcs', purchase_price BIGINT, sale_price BIGINT, mrp BIGINT,
  reorder_level INT DEFAULT 0, is_active BOOLEAN DEFAULT true
);
CREATE TABLE bike_models (id UUID PRIMARY KEY, tenant_id UUID, make TEXT, model TEXT, year_from INT, year_to INT);
CREATE TABLE product_compatibility (product_id UUID REFERENCES products, bike_model_id UUID REFERENCES bike_models, PRIMARY KEY (product_id, bike_model_id));

CREATE TABLE stock_movements (   -- append-only
  id UUID PRIMARY KEY, tenant_id UUID NOT NULL, product_id UUID REFERENCES products,
  qty INT NOT NULL,                       -- + in, - out
  reason TEXT CHECK (reason IN ('PURCHASE','SALE','RETURN_IN','RETURN_OUT','ADJUSTMENT','OPENING')),
  ref_type TEXT, ref_id UUID, unit_cost BIGINT, created_by UUID, created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE suppliers (id UUID PRIMARY KEY, tenant_id UUID, name TEXT, phone TEXT, gstin TEXT);

CREATE TABLE invoice_series (
  id UUID PRIMARY KEY, tenant_id UUID, series_code TEXT, fy TEXT, prefix TEXT, last_number INT DEFAULT 0,
  UNIQUE (tenant_id, series_code, fy)
);

CREATE TABLE invoices (
  id UUID PRIMARY KEY, tenant_id UUID NOT NULL, customer_id UUID REFERENCES customers,
  invoice_type TEXT CHECK (invoice_type IN ('TAX_INVOICE','BILL_OF_SUPPLY','RETAIL_BILL')),
  number TEXT, series_code TEXT, fy TEXT,                 -- number NULL while DRAFT
  status TEXT CHECK (status IN ('DRAFT','ISSUED','PARTIALLY_PAID','PAID','DISPUTED','CANCELLED','CREDIT_NOTED')),
  issue_date DATE, due_date DATE, place_of_supply TEXT,
  subtotal BIGINT, discount_total BIGINT, taxable_value BIGINT, cgst BIGINT, sgst BIGINT, igst BIGINT,
  round_off BIGINT DEFAULT 0, grand_total BIGINT,
  paid_now BIGINT DEFAULT 0,                              -- amount received at billing time
  amount_paid BIGINT DEFAULT 0, balance_due BIGINT,       -- derived, reconciled nightly
  version INT DEFAULT 1, cancel_reason TEXT, notes TEXT, terms TEXT,
  created_by UUID, issued_at TIMESTAMPTZ,
  UNIQUE (tenant_id, series_code, fy, number)
);
CREATE TABLE invoice_items (
  id UUID PRIMARY KEY, invoice_id UUID REFERENCES invoices, product_id UUID, description TEXT,
  hsn_code TEXT, qty NUMERIC(12,3), unit TEXT, rate BIGINT, discount BIGINT DEFAULT 0,
  taxable_value BIGINT, gst_rate_bp INT, tax_amount BIGINT, line_total BIGINT
);
CREATE TABLE invoice_versions (id UUID PRIMARY KEY, invoice_id UUID, version INT, snapshot JSONB, reason TEXT, created_by UUID, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE invoice_documents (id UUID PRIMARY KEY, invoice_id UUID, kind TEXT, storage_key TEXT, sha256 TEXT, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE share_links (id UUID PRIMARY KEY, tenant_id UUID, target_type TEXT, target_id UUID, token_hash TEXT UNIQUE, expires_at TIMESTAMPTZ, revoked_at TIMESTAMPTZ, view_count INT DEFAULT 0, first_viewed_at TIMESTAMPTZ);
CREATE TABLE invoice_events (id UUID PRIMARY KEY, invoice_id UUID, event TEXT, meta JSONB, created_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE payments (
  id UUID PRIMARY KEY, tenant_id UUID NOT NULL, customer_id UUID REFERENCES customers,
  amount BIGINT NOT NULL CHECK (amount > 0), mode TEXT CHECK (mode IN ('CASH','UPI','BANK','CHEQUE','OTHER')),
  reference TEXT, received_on DATE, received_by UUID, status TEXT DEFAULT 'CLEARED', -- or PENDING / BOUNCED
  gateway_ref TEXT UNIQUE, idempotency_key TEXT UNIQUE, notes TEXT, reverses_payment_id UUID
);
CREATE TABLE payment_allocations (
  id UUID PRIMARY KEY, payment_id UUID REFERENCES payments, invoice_id UUID REFERENCES invoices,
  amount BIGINT NOT NULL CHECK (amount > 0), strategy TEXT, created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE credit_notes (
  id UUID PRIMARY KEY, tenant_id UUID, customer_id UUID, invoice_id UUID, number TEXT, reason TEXT,
  amount BIGINT, items JSONB, restock BOOLEAN DEFAULT true, created_by UUID, created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE ledger_entries (   -- append-only source of truth
  id UUID PRIMARY KEY, tenant_id UUID NOT NULL, customer_id UUID NOT NULL,
  entry_type TEXT CHECK (entry_type IN ('INVOICE','PAYMENT','CREDIT_NOTE','DEBIT_NOTE','ADJUSTMENT','PAYMENT_REVERSAL')),
  ref_id UUID, debit BIGINT DEFAULT 0, credit BIGINT DEFAULT 0, entry_date DATE, narration TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE promises (id UUID PRIMARY KEY, tenant_id UUID, customer_id UUID, invoice_id UUID, amount BIGINT, promised_date DATE, status TEXT DEFAULT 'OPEN', logged_by UUID, created_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE message_templates (id UUID PRIMARY KEY, tenant_id UUID, key TEXT, channel TEXT, language TEXT, body TEXT, provider_template_id TEXT, approval_status TEXT);
CREATE TABLE reminder_rules (id UUID PRIMARY KEY, tenant_id UUID, name TEXT, offset_days INT, template_key TEXT, channels TEXT[], min_amount BIGINT DEFAULT 0, applies_to_status TEXT[], is_active BOOLEAN DEFAULT true);
CREATE TABLE messages (
  id UUID PRIMARY KEY, tenant_id UUID, customer_id UUID, invoice_id UUID, template_key TEXT, channel TEXT,
  to_phone TEXT, body TEXT, status TEXT CHECK (status IN ('QUEUED','SENT','DELIVERED','READ','FAILED','SKIPPED')),
  provider_msg_id TEXT, error TEXT, cost_paise INT, scheduled_for TIMESTAMPTZ, sent_at TIMESTAMPTZ
);

CREATE TABLE customer_metrics (   -- snapshot per recompute
  id UUID PRIMARY KEY, tenant_id UUID, customer_id UUID, computed_at TIMESTAMPTZ DEFAULT now(),
  on_time_rate NUMERIC(5,2), avg_days_late NUMERIC(6,2), max_days_late INT, utilization NUMERIC(5,2),
  outstanding BIGINT, overdue BIGINT, avg_order_value BIGINT, orders_90d INT, avg_gap_days NUMERIC(6,2),
  days_since_last_order INT, relationship_days INT, promise_kept_rate NUMERIC(5,2), dispute_rate NUMERIC(5,2),
  status TEXT, score INT, reason_codes TEXT[], suggested_limit BIGINT, rules_version TEXT
);
CREATE TABLE credit_limit_history (id UUID PRIMARY KEY, tenant_id UUID, customer_id UUID, old_limit BIGINT, new_limit BIGINT, reason TEXT, changed_by UUID, created_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE audit_log (id UUID PRIMARY KEY, tenant_id UUID, user_id UUID, action TEXT, entity TEXT, entity_id UUID, before JSONB, after JSONB, ip TEXT, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE backup_runs (id UUID PRIMARY KEY, kind TEXT, started_at TIMESTAMPTZ, finished_at TIMESTAMPTZ, status TEXT, storage_key TEXT, size_bytes BIGINT, verified_at TIMESTAMPTZ);

-- Useful indexes
CREATE INDEX ON invoices (tenant_id, customer_id, status, due_date);
CREATE INDEX ON ledger_entries (tenant_id, customer_id, entry_date);
CREATE INDEX ON messages (tenant_id, status, scheduled_for);
CREATE INDEX ON stock_movements (tenant_id, product_id);

-- Guard: block edits/deletes on issued invoices (sketch; refine when implementing)
-- CREATE FUNCTION forbid_issued_invoice_change() ... RAISE EXCEPTION unless only status/amount_paid/balance_due change.
-- Enable ROW LEVEL SECURITY on every tenant table with policy tenant_id = current_setting('app.tenant_id')::uuid.
