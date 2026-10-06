# 01. Product Requirements Document (PRD)

## 1. Vision
Convert the informal paper raseed/khata used between motorbike-parts wholesalers and mechanics into a digital credit ledger with professional invoices, automatic reminders and an explainable credit status. Long-term: credit infrastructure for informal auto-parts businesses.

## 2. Users
| Persona | Needs |
|---|---|
| **Owner (wholesaler)** | See who owes what, recover dues faster, control credit risk, trust the records |
| **Counter staff** | Create a bill in under 30 seconds, record payments, no accounting knowledge |
| **Mechanic / garage (customer)** | Know his balance, get proof of purchases, pay easily, no app install |
| **Accountant / CA** | Clean GST-ready exports, immutable records |

## 3. Goals and success metrics
- Bill creation under 30 seconds for repeat customers.
- Overdue amount reduced by 20% within 3 months of use.
- 90% of reminders delivered; 30% of overdue reminders lead to payment or promise within 7 days.
- Zero ledger mismatches between invoice totals, payments and balances (automated reconciliation check).

## 4. Scope
**MVP (Phase 1):** customers, product catalog + stock, B2B and B2C invoices, payments + allocation, ledger/statement, overdue dashboard, reminders, PDF + share link, backups, audit log, roles.
**Phase 2:** Green/Yellow/Red status, promise-to-pay, credit notes/returns, UPI payment links + auto-reconcile, photo-to-entry, WhatsApp text/voice entry.
**Phase 3:** customer portal, installment plans, interest/late fee rules, GST reports, Tally export, multi-wholesaler network, partner financing.
**Out of scope for now:** the business lending its own cash loans (regulated), acting as a credit bureau, ML scoring.

## 5. Functional requirements

### FR-1 Customers
- Create/edit: name, shop name, phone (WhatsApp flag), address, GSTIN (optional), type (garage, retailer, walk-in), photo, notes, credit limit, default payment terms (days), opt-in/out for messages.
- Walk-in B2C customers can be anonymous.
- Search by name/phone; duplicate phone detection.

### FR-2 Products and inventory
- Product: name, part number, brand, category, bike-model compatibility (many-to-many), HSN code, GST rate, unit, purchase price, sale price, MRP, reorder level.
- Stock movements are an append-only table (purchase in, sale out, return, adjustment). Stock = sum of movements.
- Low-stock alert; warn (do not block) on selling below zero stock.
- Per-customer purchase history by product.

### FR-3 Invoicing
- Types: `TAX_INVOICE` (B2B GST), `BILL_OF_SUPPLY`, `RETAIL_BILL` (B2C). The format used is chosen per sale, with tenant defaults.
- Quick-bill mode: pick customer, add items (search or scan), enter "paid now", balance is auto-computed on credit, due date defaults from customer terms.
- "Copy last invoice" for repeat orders.
- Sequential numbering per FY and series. Discounts per line and per invoice. GST split CGST/SGST vs IGST based on place of supply. Rounding line. Amount in words.
- Lifecycle: `DRAFT → ISSUED → PARTIALLY_PAID → PAID`, plus `OVERDUE` (derived), `DISPUTED`, `CANCELLED`, `CREDIT_NOTED`.
- Issued invoices are immutable (see AGENTS.md rule 2).
- Output: A4 professional PDF, 80mm thermal/A5 compact for B2C, share via WhatsApp/SMS/email, public view link (no login, tokenised, revocable).
- Invoice shows paid now, balance due, optional previous outstanding, UPI QR, terms, delivery acknowledgement block.

### FR-4 Payments and allocation
- Modes: cash, UPI, bank transfer, cheque, other. Reference number, date, received by.
- Allocation: oldest-first default; manual allocation UI; unallocated advance supported; payment reversal (bounced cheque) creates a reversing entry, never a delete.
- Payment receipt PDF + auto message to customer.

### FR-5 Ledger and statements
- Per-customer ledger: chronological debit (invoices) and credit (payments, credit notes) with running balance.
- Statement PDF for a date range; share by link/WhatsApp.
- Aging buckets: current, 1-30, 31-60, 61-90, 90+ days.

### FR-6 Reminders
- Rule-based schedule per tenant: before due (-3), due day (0), overdue (+3, +7, +15, +30). Tone varies by risk status.
- Channels: WhatsApp (templates), SMS (DLT templates), fallback order configurable. Voice call = Phase 3.
- Event messages: invoice issued, payment received, statement, promise-to-pay confirmation.
- Quiet hours, opt-out keyword handling (STOP), per-customer pause, delivery status tracking, retry with backoff, cost log.
- Preview and manual "send now" from UI. Templates in English and Hinglish.

### FR-7 Credit status and score (explainable)
- Phase 2: Green/Yellow/Red from rules. Phase 3: 300-900 score once ≥ 6 months and ≥ 20 customers have history.
- Inputs: on-time rate, average days late, utilization, outstanding trend, purchase frequency and recency, relationship age, promise kept ratio, dispute rate.
- Output always includes reason codes and plain-language explanation. Owner can override with a reason (audited).
- Auto-suggest credit limit; block/warn rule when new sale exceeds limit or overdue > X days (tenant setting: warn or block, owner override).
- See `06_CREDIT_SCORING_SPEC.md`.

### FR-8 Dashboard and reports
- Today: total outstanding, overdue, collected today/week/month, top 10 defaulters, upcoming dues.
- Reports: aging, collection efficiency, sales by customer/product, slow movers, stock valuation, GST summary (Phase 3). All exportable to CSV/XLSX/PDF.

### FR-9 Admin, security, backup
- Roles and permissions matrix (Section 7). Audit log viewer. Owner 2FA.
- Automated daily DB backups (≥30 days, different region), permanent PDF archive, one-click full export, backup status page, quarterly restore test checklist.

## 6. Non-functional requirements
- Mobile-first, works on low-end Android and slow networks; pages usable under 3 s on 4G.
- Offline-tolerant bill creation (queue and sync) is Phase 2.
- Availability target 99.5%. Backups RPO ≤ 24 h (point-in-time recovery preferred), RTO ≤ 4 h.
- Encryption in transit and at rest. PII minimisation. DPDP-ready consent records.
- Accessibility: large tap targets, high contrast, simple Hinglish labels.

## 7. Permissions matrix
| Action | Owner | Manager | Counter staff |
|---|---|---|---|
| Create invoice / payment | ✔ | ✔ | ✔ |
| Cancel invoice, issue credit note | ✔ | ✔ | ✘ |
| Change credit limit / override status | ✔ | ✘ | ✘ |
| View reports and all customers | ✔ | ✔ | limited |
| Manage users, templates, settings, backups | ✔ | ✘ | ✘ |
| Export data | ✔ | ✔ | ✘ |

## 8. Key user flows (acceptance-test seeds)
1. **Credit sale:** Counter staff selects Ramesh Garage, adds items totalling ₹20,000, enters paid ₹2,000 → invoice issued, balance ₹18,000, WhatsApp "bill + balance" sent, ledger updated.
2. **Second purchase and part-payment:** Same customer buys ₹30,000, pays ₹5,000 → total outstanding ₹43,000 (assuming ₹18,000 + ₹25,000), oldest-first allocation visible.
3. **Collections:** Invoice due date passes → reminders fire on schedule; customer replies promise date → staff logs promise → follow-up reminder.
4. **Return:** Defective part → credit note against invoice → ledger and stock adjust, customer notified.
5. **Backup restore:** Owner downloads full export and verifies the totals match the dashboard.

## 9. Compliance and legal checklist (verify with CA / lawyer)
- GST invoice fields, HSN, e-invoicing threshold, bill of supply rules.
- WhatsApp Business API: opt-in, template approval, 24-hour session rules.
- SMS: TRAI DLT entity, sender ID and template registration.
- DPDP Act: consent, purpose limitation, data deletion/export on request, breach process.
- Interest/late fees: written agreement upfront. Cash lending or sharing scores with third parties may need NBFC/CIC compliance.
- Record retention period for accounting records.
*This is a checklist, not legal advice.*

## 10. Open questions (owner to answer)
1. Are you GST-registered, and what share of customers need GST invoices?
2. Typical payment terms offered (15/30/45 days)? Any interest or late fee today?
3. Multiple counters/branches or single shop at launch?
4. Hindi/Hinglish UI priority for staff vs only for customer messages?
5. Existing data to migrate (Excel, paper, Tally)?
6. Is Phase 1 for your own business only, or will other wholesalers use it soon (affects multi-tenancy billing)?
