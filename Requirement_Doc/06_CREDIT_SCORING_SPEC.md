# 06. Credit Status and Score Specification (rules-based, explainable)

Principle: no ML in v1. Every output carries reason codes. Humans can override. Rules are versioned (`rules_version`) so old results stay explainable.

## 1. Metrics (computed nightly and on every payment into `customer_metrics`)
| Metric | Definition |
|---|---|
| on_time_rate | Share of invoices (last 12 months, fully paid or past due) paid by due date, weighted by amount |
| avg_days_late | Average days between due date and payment date for late invoices (0 if none) |
| max_days_late | Longest delay in the last 12 months |
| utilization | outstanding ÷ credit_limit |
| overdue | Sum of balance on invoices past due date |
| outstanding_trend | Outstanding now vs. 60 days ago (growing / flat / shrinking) |
| avg_order_value, orders_90d, avg_gap_days, days_since_last_order | Purchase behavior |
| relationship_days | Days since first invoice |
| promise_kept_rate | Promises fulfilled on time ÷ promises made |
| dispute_rate | Disputed or credit-noted invoices ÷ total invoices |

## 2. Eligibility
- Fewer than **5 invoices or 60 days of history** → status `NEW` (no score). Use conservative default limit set by owner.
- Numeric score (300-900) only when the tenant has ≥ 20 customers with ≥ 6 months of history. Otherwise show Green/Yellow/Red only.

## 3. Green / Yellow / Red rules (first match wins, evaluate top-down)
**RED** if any:
- overdue amount > 0 AND oldest overdue > 60 days
- avg_days_late > 30 over last 6 invoices
- utilization > 120%
- 2 or more bounced/reversed payments in 90 days

**YELLOW** if any:
- oldest overdue between 15 and 60 days
- on_time_rate < 70%
- utilization between 90% and 120%
- promise_kept_rate < 50% (with ≥ 2 promises)
- days_since_last_order > 3 × avg_gap_days while outstanding > 0

**GREEN** otherwise.

All thresholds are tenant-configurable defaults in `settings.credit`.

## 4. Score (300-900) when eligible
Start at 300; add points:
| Component | Max points | Calculation |
|---|---|---|
| Repayment behavior | 240 (40%) | 0.7 × on_time_rate + 0.3 × (1 − min(avg_days_late/30, 1)), scaled to 240 |
| Utilization and trend | 120 (20%) | 120 at ≤ 50% utilization, linear to 0 at ≥ 120%; −20 if outstanding trend growing while overdue |
| Purchase consistency | 90 (15%) | Based on orders_90d vs. expected and stability of gap days |
| Relationship age and volume | 60 (10%) | Capped by 24 months and monthly volume tiers |
| Promise reliability | 60 (10%) | promise_kept_rate scaled (neutral 30 if no promises) |
| Disputes/returns | 30 (5%) | 30 × (1 − min(dispute_rate/0.2, 1)) |
Total max = 300 + 600 = 900. Bands: 750+ Excellent, 650-749 Good, 550-649 Fair, below 550 Poor.

## 5. Reason codes (always returned, with plain text for the owner and a softer text for the customer)
`PAYS_LATE_AVG`, `OVERDUE_60_PLUS`, `OVERDUE_15_60`, `HIGH_UTILIZATION`, `LOW_ON_TIME_RATE`, `BROKEN_PROMISES`, `ORDERS_DROPPING`, `NEW_CUSTOMER`, `CONSISTENT_BUYER`, `LONG_RELATIONSHIP`, `PAYS_ON_TIME`, `BOUNCED_PAYMENT`, `HIGH_DISPUTES`.
Example: "Yellow: pays 18 days late on average; 92% of limit used."

## 6. Suggested credit limit
```
base = 0.5 × average monthly purchase (last 3 months)
multiplier: GREEN 1.0 (up to 1.5 if score ≥ 750), YELLOW 0.6, RED 0 (advance/cash only), NEW fixed starter limit
suggested_limit = round_to_1000(base × multiplier); never raise more than 25% per review; never auto-apply
```
Suggestions appear for the owner to accept; changes are logged in `credit_limit_history`.

## 7. Actions linked to status
| Status | Sale rule (tenant setting) | Reminder tone | Other |
|---|---|---|---|
| GREEN | Allow | Friendly, early | Offer limit increase |
| YELLOW | Warn staff | Firm, earlier follow-ups | Ask for promise date |
| RED | Block or require owner override | Formal, frequent within allowed hours | Owner call task, advance payment suggested |
| NEW | Starter limit | Friendly | Review after 5 invoices |

## 8. Fairness and safeguards
- Show the customer their own balance and history in their view link; frame as "your payment record".
- Owner override requires a reason and is audited. Recompute never erases overrides; it shows both.
- Do not share scores with third parties without explicit customer consent and legal review.
- Backtest the rules on pilot data before turning on blocking; start with warnings only.

## 9. Test cases (unit tests to write)
1. Customer with all invoices paid on time → GREEN, high score, reason PAYS_ON_TIME.
2. One invoice 70 days overdue → RED regardless of other metrics.
3. 3 invoices only → NEW, no score.
4. Utilization 100% with no overdue → YELLOW.
5. Override to GREEN with reason keeps the computed RED visible in history.
6. Suggested limit never exceeds +25% of current limit.
