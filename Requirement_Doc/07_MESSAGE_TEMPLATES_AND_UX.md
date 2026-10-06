# 07. Message Templates and UX Guidelines

## 1. Template rules
- Submit all WhatsApp templates for provider/Meta approval; register SMS templates under DLT. Variables use `{{1}}` style in the provider but are named here for clarity.
- Keep messages short, polite, and always include: customer name, amount, invoice number, due date, and a link.
- Only send to customers who opted in. Include an opt-out line in marketing-type messages; support the STOP keyword.
- Never shame or threaten. Tone ladder: Friendly → Firm → Formal.

## 2. Template library (English / Hinglish)
| Key | When | English | Hinglish |
|---|---|---|---|
| `invoice_issued` | On issue | Hello {{name}}, bill {{inv_no}} of ₹{{total}} from {{shop}}. Paid: ₹{{paid}}. Balance: ₹{{balance}}, due {{due_date}}. View: {{link}} | Namaste {{name}}, {{shop}} se bill {{inv_no}} ₹{{total}} ka. Diya: ₹{{paid}}. Baaki: ₹{{balance}}, {{due_date}} tak. Dekhein: {{link}} |
| `payment_received` | On payment | Thank you {{name}}. We received ₹{{amount}} on {{date}}. Remaining balance: ₹{{balance}}. Statement: {{link}} | Dhanyavaad {{name}}. ₹{{amount}} mile ({{date}}). Baaki balance: ₹{{balance}}. Statement: {{link}} |
| `due_soon` (-3) | 3 days before | Hi {{name}}, a gentle reminder: ₹{{balance}} for bill {{inv_no}} is due on {{due_date}}. Pay: {{link}} | {{name}} ji, yaad dilana tha: bill {{inv_no}} ka ₹{{balance}} {{due_date}} ko dena hai. Payment: {{link}} |
| `due_today` (0) | Due date | {{name}}, ₹{{balance}} for bill {{inv_no}} is due today. Pay: {{link}} | {{name}} ji, aaj bill {{inv_no}} ka ₹{{balance}} dena hai. Payment: {{link}} |
| `overdue_soft` (+3, +7) | Overdue | {{name}}, ₹{{balance}} for bill {{inv_no}} was due on {{due_date}}. Please pay or reply with your payment date. {{link}} | {{name}} ji, bill {{inv_no}} ka ₹{{balance}} {{due_date}} ko dena tha. Kripya bhejein ya payment ki date batayein. {{link}} |
| `overdue_firm` (+15) | Overdue | {{name}}, ₹{{balance}} is overdue by {{days}} days (bill {{inv_no}}). Please clear it this week to continue credit. {{link}} | {{name}} ji, ₹{{balance}} {{days}} din se baaki hai (bill {{inv_no}}). Is hafte clear karein, tabhi aage udhaar chalega. {{link}} |
| `overdue_formal` (+30) | Overdue | Dear {{name}}, ₹{{balance}} is overdue by {{days}} days. Please contact {{owner_phone}} to settle or agree a plan. | {{name}} ji, ₹{{balance}} {{days}} din se baaki hai. Kripya {{owner_phone}} par baat karke settle karein. |
| `promise_confirm` | Promise logged | Noted {{name}}: you will pay ₹{{amount}} by {{date}}. Thank you. | Note kar liya {{name}} ji: ₹{{amount}} {{date}} tak denge. Dhanyavaad. |
| `promise_followup` | Day after promise | {{name}}, today was your promised date for ₹{{amount}}. Please pay: {{link}} | {{name}} ji, aaj ₹{{amount}} ki promised date thi. Payment: {{link}} |
| `statement_ready` | Monthly | {{name}}, your statement for {{month}} is ready. Balance: ₹{{balance}}. {{link}} | {{name}} ji, {{month}} ka statement ready hai. Balance: ₹{{balance}}. {{link}} |
| `credit_note` | Return | {{name}}, credit of ₹{{amount}} added for returned items on bill {{inv_no}}. New balance: ₹{{balance}}. | {{name}} ji, bill {{inv_no}} ke return ka ₹{{amount}} credit mila. Naya balance: ₹{{balance}}. |

## 3. Reminder rule defaults
| Offset | Template | Channels | Notes |
|---|---|---|---|
| -3 | due_soon | WhatsApp → SMS | Skip if balance < ₹100 |
| 0 | due_today | WhatsApp → SMS | |
| +3 | overdue_soft | WhatsApp → SMS | |
| +7 | overdue_soft | WhatsApp | |
| +15 | overdue_firm | WhatsApp + SMS | Create owner call task for YELLOW/RED |
| +30 | overdue_formal | WhatsApp + SMS | Notify owner |
Send window: 9:00 to 20:00 IST. Max 1 reminder per customer per day (combine multiple invoices into one message with total). Stop reminders when the balance is zero or the customer is paused.

## 4. UX principles
1. **Speed beats completeness.** The Quick Bill screen: customer search → add items (search by part no., name, or bike model) → qty → "Paid now" field → big Issue button. Target under 30 seconds repeat customer.
2. **Big buttons, minimal typing,** number pad for amounts, recent customers and recent items first.
3. **Always show balance.** Selecting a customer instantly shows outstanding, overdue, limit and status color.
4. **Plain words.** Labels such as "Udhaar / Baaki / Diya" available with a language toggle.
5. **Confirmation before irreversible actions** (issue, cancel, reverse) with clear summary.
6. **Customer view page** (no login): invoice, running balance, pay button, "I received this" confirm, "Raise issue" button. Loads fast on 3G.
7. **Never lose work:** autosave drafts; clear error messages; retry on network failure.

## 5. Screen list (MVP)
Login, Dashboard, Customers list and detail (ledger tab, invoices tab, credit tab, messages tab), Quick Bill, Invoice detail, Payments (new and list), Products list and detail, Stock, Reminders (rules, templates, queue, log), Reports, Settings (business profile, users, series, terms), Audit log, Backups and exports, Public invoice page, Public statement page.

## 6. Invoice PDF layout checklist
Logo and business block, GSTIN, invoice number and dates, bill-to and ship-to, items table (part no., description, HSN, qty, rate, disc, tax, amount), tax summary, totals, amount in words, **Paid now and Balance due box**, previous outstanding (toggle), bank and UPI QR, terms (return window, warranty, late-fee clause if agreed), signature block, delivery acknowledgement, "Computer generated" footer with page numbers.
