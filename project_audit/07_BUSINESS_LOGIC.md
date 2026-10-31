# 07. Financial & Business Logic Reference

## 1. GST & Tax Calculation Engine (`server/lib/tax.ts`)

The tax engine calculates all invoice totals in integer paise:
- 1 Rupee = 100 Paise.
- ₹1,250.50 is represented as `125050n`.
- GST rates are represented in Basis Points (bp): 18% GST = `1800` bp, 28% GST = `2800` bp.

### Algorithm: `calculateInvoiceTax(items, sellerStateCode, buyerStateCode)`
1. **Intra-state vs Inter-state Check**:
   $$\text{isIntraState} = (\text{sellerStateCode} == \text{buyerStateCode})$$
   - If Intra-state (e.g. Maharashtra to Maharashtra, `27` == `27`): Tax is split equally into **CGST** (50%) and **SGST** (50%).
   - If Inter-state (e.g. Delhi `07` to UP `09`): Tax is charged as **IGST** (100%).
2. **Line Item Math**:
   - Gross line total: $\text{gross} = \text{qty} \times \text{ratePaise}$.
   - Line discount:
     $$\text{discount} = \text{discountPaise} + \left( \text{gross} \times \frac{\text{discountPercent}}{100} \right)$$
   - Taxable value: $\text{taxable} = \text{gross} - \text{discount}$.
   - Tax amount:
     $$\text{tax} = \text{Math.round}\left( \frac{\text{taxable} \times \text{gstRateBp}}{10000} \right)$$
3. **Roundoff Calculation**:
   - Exact sum: $\text{exactTotal} = \text{taxableValue} + \text{cgst} + \text{sgst} + \text{igst}$.
   - Rounded Rupee total: $\text{roundedRupees} = \text{Math.round}(\text{exactTotal} / 100)$.
   - Grand Total in paise: $\text{grandTotal} = \text{roundedRupees} \times 100$.
   - Roundoff adjustment: $\text{roundOff} = \text{grandTotal} - \text{exactTotal}$.

---

## 2. FIFO Payment Allocation Engine (`server/lib/allocation.ts`)

### Purpose
When a customer pays a lump sum (e.g. ₹50,000 via UPI), the system must determine which specific past credit invoices are being settled.

### Algorithm: `allocatePayment(paymentAmount, openInvoices, strategy, manualLines)`
1. **Strategy: `OLDEST_FIRST` (Default FIFO)**:
   - Sorts `openInvoices` by `dueDate` ascending (or `createdAt` ascending).
   - Iterates through invoices:
     ```ts
     let remainingPayment = paymentAmount;
     for (const inv of sortedInvoices) {
       if (remainingPayment <= 0n) break;
       const allocateAmt = remainingPayment >= inv.balanceDue ? inv.balanceDue : remainingPayment;
       allocations.push({ invoiceId: inv.id, amount: allocateAmt });
       remainingPayment -= allocateAmt;
     }
     const unallocatedAdvance = remainingPayment;
     ```
   - If `unallocatedAdvance > 0n`, the excess payment remains credited to the customer's account as an advance deposit.
2. **Strategy: `MANUAL`**:
   - Directly assigns amounts requested by the clerk, validating that:
     $$\sum (\text{manualLine.amount}) \le \text{paymentAmount}$$
     $$\text{manualLine.amount} \le \text{invoice.balanceDue}$$

---

## 3. Explainable Credit Scoring Engine (`app/lib/creditScore.ts`)

Instead of black-box machine learning models, AutoLedger ERP utilizes a deterministic, auditable **300–900 credit scoring formula** tailored for trade credit in Indian bazaars:

| Factor | Weight | Scoring Condition |
|---|---|---|
| **On-Time Repayment Ratio** | 35% | Percent of past invoices cleared within agreed terms (e.g. 15 or 30 days) |
| **Credit Limit Utilization** | 25% | $\text{Current Balance} / \text{Credit Limit}$. Lower utilization yields higher score |
| **Aging Overdue Penalty** | 20% | Heavy penalties for invoices lingering in 61–90d and 90+ days buckets |
| **Relationship Age & Frequency** | 10% | Number of months trading with wholesaler and monthly purchase velocity |
| **Dispute / Bounce Rate** | 10% | Deductions for bounced cheques or disputed bills |

### Status Categorization:
- **GREEN (Score 700–900)**: Prompt payer, low risk. Counter billing allows full credit sales up to limit.
- **YELLOW (Score 550–699)**: Moderate risk. Approaching credit limit or bills overdue by 15–30 days. Yellow warning badge on POS screen.
- **RED (Score 300–549)**: High risk / defaulted. Overdue > 45 days or credit limit exceeded. POS billing prompts counter clerk to collect cash before releasing parts.

---

## 4. End-of-Day Settlement (Z-Report Math) (`app/api/v1/reports/settlement`)

At the close of trading, the counter manager conducts a physical cash reconciliation:
1. **System Calculated Totals**:
   - $\text{Cash Collected} = \sum (\text{Invoice Cash Paid Now}) + \sum (\text{Direct Cash Payments})$
   - $\text{UPI Collected} = \sum (\text{Invoice UPI Paid Now}) + \sum (\text{Razorpay Gateway Collections})$
   - $\text{Total Gross Sales} = \sum (\text{Grand Total of Day Invoices})$
   - $\text{Credit Extended (Udhar)} = \text{Total Gross Sales} - (\text{Cash} + \text{UPI} + \text{Bank})$
2. **Physical Currency Denomination Counter**:
   - Counts notes: $500 \times N_{500} + 200 \times N_{200} + 100 \times N_{100} + 50 \times N_{50} + 20 \times N_{20} + 10 \times N_{10} + \text{Coins}$
3. **Variance & Discrepancy**:
   $$\text{Expected Cash in Drawer} = \text{Opening Float} + \text{System Cash Collected} - \text{Cash Expenses}$$
   $$\text{Discrepancy (Variance)} = \text{Physical Cash Counted} - \text{Expected Cash in Drawer}$$
   - If positive: **Cash Excess** (unrecorded cash sale).
   - If negative: **Cash Shortage** (missing drawer money or untracked counter expense).
