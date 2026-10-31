# 14. Open Questions & Owner Decisions Checklist

Before deploying to live pilot testing with real automotive wholesalers and mechanics, the business owner must clarify the following architectural and business decisions:

---

## 1. Statutory & Compliance Questions (Verify with CA / Tax Lawyer)
1. **Invoice Series & Financial Year Format**:
   - What is the preferred numbering format for the financial year? (e.g. `INV/2026-27/00001` vs `AL/26-27/0001`).
   - Will the business use separate numbering series for B2B Tax Invoices vs Retail Walk-in Cash Slips?
2. **E-Invoicing Threshold**:
   - Is the business required to generate IRN (Invoice Reference Number) and e-Way bills via the government GST portal (applicable if annual turnover exceeds ₹5 Crores)?
3. **Credit Terms & Interest on Overdue Balances**:
   - Does the wholesaler charge interest or late fees on bills overdue past 30/60 days? If so, Indian contract law requires written consent signed upfront.

---

## 2. Infrastructure & Messaging Provider Decisions
1. **WhatsApp Provider Selection**:
   - Which WhatsApp Business API provider will be used? Options: Gupshup, Interakt, Twilio, or Wati.
   - Meta requires pre-approved HSM templates for outbound utility reminders. Who will manage template approvals?
2. **SMS DLT Registration**:
   - Has the business registered an Entity and Sender Header (e.g. `AUTOLD`) on the Indian TRAI DLT portal for sending transactional SMS notifications?
3. **Cloud Database vs Local Primary**:
   - Will the shop run a local desktop machine as a local LAN server that other counter terminals connect to, or will all terminals connect to a managed cloud PostgreSQL database?

---

## 3. Operational & Feature Preferences
1. **Selling Below Zero Stock**:
   - If a counter clerk sells a brake pad that shows 0 inventory in the system (because fresh stock arrived this morning but wasn't entered into the software yet), should the system:
     - (A) Warn the clerk but **allow** the bill to complete (Recommended for auto-parts).
     - (B) **Block** the sale until purchase stock is recorded.
2. **Credit Limit Hard Block vs Soft Warning**:
   - When a mechanic whose credit limit is ₹25,000 tries to buy ₹10,000 of parts while his outstanding balance is already ₹24,000, should the POS screen:
     - (A) Flash a yellow warning and allow counter staff to proceed.
     - (B) Hard block the invoice unless an Owner/Manager PIN override is entered.
