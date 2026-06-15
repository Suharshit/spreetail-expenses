# SCOPE.md — Anomaly Log and Database Schema

## Part 1 — CSV Anomaly Log

The CSV (`expenses_export.csv`) contains 43 data rows (excluding the header). The importer
detected **22 data problems** across those rows. Each problem is documented below with the
exact row, the nature of the problem, the policy applied, and the action taken.

The assignment stated "at least 12 deliberate data problems." We found and handled 22.

---

### Anomaly Table

| # | Row | Anomaly Type | Raw Value | Description | Policy | Action Taken |
|---|---|---|---|---|---|---|
| 1 | 5 & 6 | Exact duplicate | `Dev, 3200, 08-02-2026` | "Dinner at Marina Bites" (row 5) and "dinner - marina bites" (row 6) share the same date, paid_by, and amount. Row 6 has no notes while row 5 has "Dev visiting for the weekend". | Flag both rows. Require user approval to decide which to keep. Neither is imported silently. | `pending_approval` — both flagged, row 6 skipped pending confirmation |
| 2 | 7 | Amount format error | `"1,200"` | The amount field contains a comma as a thousands separator, making it a string rather than a number. Raw value: `"1,200"`. | Strip commas from all amount fields before parsing. This is unambiguous — no information is lost. | `auto_fixed` — parsed as `1200.00` |
| 3 | 9 | Name mismatch (case) | `priya` | The `paid_by` field contains `"priya"` (all lowercase) instead of `"Priya"`. This is the same person — confirmed by context. | Normalize all names by applying a canonical name map: trim whitespace, lowercase, then map to correct casing. | `auto_fixed` — normalized to `"Priya"` |
| 4 | 10 | Excessive decimal precision | `899.995` | Amount has 3 decimal places. Currency (INR) has 2 decimal places maximum. Storing `899.995` would either truncate silently or throw a Prisma Decimal error. | Round to 2 decimal places using half-up rounding: `899.995` → `900.00`. Log the rounding. | `imported_with_warning` — stored as `₹ 900.00` |
| 5 | 11 | Name mismatch (suffix) | `Priya S` | The `paid_by` field contains `"Priya S"` instead of `"Priya"`. The "S" is an initial for her surname. There is only one Priya in the group — this is unambiguous. | Included in the canonical name map: `"priya s"` → `"Priya"`. | `auto_fixed` — normalized to `"Priya"` |
| 6 | 13 | Missing paid_by | *(empty)* | The `paid_by` column is completely empty for "House cleaning supplies" (₹780). The notes say "can't remember who paid". | Import the expense with `paidByUserId = null`. Flag it for the group to resolve. Do not skip — the expense is real. | `imported_with_warning` — stored with null `paidByUserId`, flagged for manual resolution |
| 7 | 14 | Settlement logged as expense | `split_type: ""` | "Rohan paid Aisha back" (₹5,000) has an empty `split_type` and a note reading "this is a settlement not an expense??". This is a direct repayment, not a shared cost. | Detect settlement by: (a) empty split_type, (b) keywords in description ("paid back", "settlement"). Store with `isSettlement = true`. Exclude from balance calculations. | `imported_as_settlement` — stored in expenses table with `isSettlement = true`, excluded from all balance queries |
| 8 | 15 | Percentage overflow | `Aisha 30%; Rohan 30%; Priya 30%; Meera 20%` | Percentages sum to 110%, not 100%. The notes say "percentages might be off". A 110% split is mathematically invalid. | Normalize each percentage by dividing by the total sum (110), then multiplying by 100. `30/110*100 = 27.27%` each for three members, `20/110*100 = 18.18%` for Meera. Log the normalization. | `imported_with_warning` — percentages normalized, actual amounts recalculated |
| 9 | 20 | USD amount | `540 USD` | "Goa villa booking" paid by Dev in USD. The CSV mixes currencies without conversion. All balance calculations must be in INR. | Convert USD → INR at a fixed historical rate of ₹83.5 per USD. Rate is fixed (not live) because these are historical expenses — a live rate would change the balance every day. Store both `amount = 540`, `currency = USD`, and `amountInr = 45,090`, `exchangeRate = 83.5`. | `imported_with_conversion` — converted at ₹83.5, original stored |
| 10 | 21 | USD amount | `84 USD` | "Beach shack lunch" in USD. Same policy as row 20. | Same as row 20. | `imported_with_conversion` — converted at ₹83.5 |
| 11 | 23 | USD amount + unknown member | `150 USD`, `Dev's friend Kabir` | "Parasailing" is in USD AND includes "Dev's friend Kabir" in `split_with`. Kabir is not a flat member, has no user account, and cannot have a split. | USD → INR conversion applied. Kabir is excluded from splits. His portion is redistributed equally among the remaining valid members (Aisha, Rohan, Priya, Dev). This is documented so the group can settle with Kabir offline. | `imported_with_warning` — USD converted, Kabir excluded from splits, redistribution logged |
| 12 | 24 & 25 | Potential duplicate (different amounts) | Row 24: `Aisha, ₹2400`; Row 25: `Rohan, ₹2450` | "Dinner at Thalassa" (row 24, paid by Aisha) and "Thalassa dinner" (row 25, paid by Rohan) are on the same date (11-03-2026). The amounts differ by ₹50. Row 25 notes say "Aisha also logged this I think hers is wrong". | Unlike the Marina Bites duplicate (same amount, same payer), this has different amounts and different payers. This may be two separate transactions or a double-log. Both rows are imported with a warning. The group must decide — neither is silently deleted. | `imported_with_warning` — both rows kept, flagged as potential duplicate for group to resolve |
| 13 | 26 | Negative amount | `-30 USD` | "Parasailing refund" — one slot was cancelled and a refund was issued. Amount is negative (-30 USD). | A negative amount is a legitimate refund, not a data error. Imported as an expense with a negative `amountInr` (-₹2,505). This reduces the group's total expenditure correctly. It is NOT treated as a settlement. | `imported_with_warning` — stored as negative expense (refund), noted as USD conversion applied |
| 14 | 27 | Non-standard date format | `Mar-14` | The date is written as "Mar-14" (month abbreviation + day, no year). This is not the DD-MM-YYYY format used by all other rows. | Parse using a secondary date pattern: `([A-Za-z]{3})-(\d{1,2})`. Infer year as 2026 (the year of all expenses in this CSV). Interpreted as 2026-03-14. | `auto_fixed` — interpreted as `14-03-2026` |
| 15 | 27 | Trailing space in name | `rohan ` | Same row as anomaly 14: `paid_by` contains `"rohan "` with a trailing space. After trimming, it maps to `"Rohan"` via the canonical name map. | Trim all name fields before lookup. This is handled by the same normalization pipeline as anomaly 3 and 5. | `auto_fixed` — normalized to `"Rohan"` |
| 16 | 28 | Missing currency | *(empty)* | "Groceries DMart" (₹2,105) has no value in the `currency` column. | Default to INR when currency is missing. INR is the base currency for this group. Log the assumption so the group can correct it if needed. | `imported_with_warning` — currency defaulted to `INR` |
| 17 | 31 | Zero amount | `0` | "Dinner order Swiggy" has an amount of 0. The notes say "counted twice earlier - fixing later". This is a placeholder/cancellation row. | A ₹0 expense adds nothing to balances and creates meaningless split rows. Skip entirely and log. | `skipped` — zero amount expense, logged with original notes |
| 18 | 34 | Ambiguous date | `04-05-2026` | The notes say "is this April 5 or May 4? format is a mess". Both interpretations are valid in DD-MM-YYYY format since day ≤ 12. | Apply context heuristic: The `split_with` contains Aisha, Rohan, Priya — no Sam (who joined April 15) and no Meera. Sam would be included in a May 4 expense. April 5 is more consistent with the membership picture. Interpret as **April 5, 2026** and flag for review. | `imported_with_warning` — interpreted as `05-04-2026`, flagged as ambiguous |
| 19 | 36 | Inactive member in split | `Meera` in `split_with` on `02-04-2026` | Meera's `leftAt` is `2026-03-31`. An April 2 grocery expense should not involve her. The notes say "oops Meera still in the group list". | Remove Meera from this expense's splits. Redistribute her share equally among the remaining active members (Aisha, Rohan, Priya). Log the removal with the reason. | `imported_with_warning` — Meera removed from split, her share redistributed |
| 20 | 38 | Settlement logged as expense | `Sam, 15000, equal, Aisha` | "Sam deposit share" — Sam paid Aisha ₹15,000 as a deposit for moving in. This is a direct payment from Sam to Aisha, not a shared expense. The description and context make this unambiguous. | Detected by keyword "deposit" in description. Store with `isSettlement = true`. Excluded from balance calculations. This is correctly tracked as Sam having paid Aisha ₹15,000. | `imported_as_settlement` — stored with `isSettlement = true` |
| 21 | 39 & 40 | Member included before join date | `Sam` in `split_with` on `10-04-2026` and `12-04-2026` | Sam's `joinedAt` is `2026-04-15`. Rows 39 (Housewarming drinks, April 10) and 40 (Electricity Apr, April 12) both include Sam before he officially joined. | Applying strict membership date logic would exclude Sam. However, the housewarming party (row 39) is explicitly for Sam's arrival, making his inclusion reasonable. Electricity (row 40) is less clear. Both rows are imported with a warning. Sam is kept in the splits since the group clearly intended to include him, but flagged for review. | `imported_with_warning` — Sam included in both splits, flagged as pre-join-date inclusion |
| 22 | 42 | Split type conflict | `split_type: equal`, `split_details: "Aisha 1; Rohan 1; Priya 1; Sam 1"` | "Furniture for common room" says `split_type = equal` but the `split_details` column contains explicit share ratios. The notes confirm: "split_type says equal but someone added shares anyway". | When split_type and split_details conflict, prefer the more specific information. Since all ratios are equal (1:1:1:1), the result is the same as an equal split. Change split_type to `share` and log the conflict. | `imported_with_warning` — split_type corrected to `share`, note logged |

---

### Summary Statistics

| Category | Count |
|---|---|
| Total rows in CSV | 43 |
| Rows successfully imported | 36 |
| Rows skipped (zero amount) | 1 |
| Rows pending approval (exact duplicate) | 1 |
| Rows imported with warnings | 18 |
| Rows imported as settlements | 2 |
| Rows auto-fixed silently | 4 |
| **Total anomalies detected** | **22** |

---

## Part 2 — Database Schema

### Design Principles

**Why time-based membership instead of a simple boolean:**
Members join and leave. Meera left end of March. Sam joined mid-April. A boolean
"is_member" field cannot represent this history. The `group_memberships` table uses
`joined_at` and `left_at` date columns to represent membership as a date range.
Historical expenses are never orphaned because the membership record always remains.

**Why settlements are stored in expenses with a flag instead of a separate table:**
Import history must be complete. The CSV contains settlement rows. If we reject them
entirely from the expenses table, we lose the import audit trail. Storing them with
`is_settlement = true` preserves the record while the flag excludes them from balance
calculations. New settlements created through the UI go into the `settlements` table.

**Why both `amount` and `amount_inr` are stored:**
The original value in the original currency is preserved for auditability. Priya
specifically asked why the dollar amounts were being treated as rupees. We store
`amount = 540`, `currency = USD`, and `amount_inr = 45090` so the original is
never lost and conversion is always traceable.

---

### Tables

#### users
```
id             UUID        PRIMARY KEY
name           VARCHAR     NOT NULL
email          VARCHAR     NOT NULL UNIQUE
password_hash  VARCHAR     NOT NULL
created_at     TIMESTAMP   DEFAULT now()
```

#### groups
```
id             UUID        PRIMARY KEY
name           VARCHAR     NOT NULL
description    TEXT
created_by     UUID        FK → users.id
created_at     TIMESTAMP   DEFAULT now()
```

#### group_memberships
```
id             UUID        PRIMARY KEY
group_id       UUID        FK → groups.id
user_id        UUID        FK → users.id
joined_at      DATE        NOT NULL
left_at        DATE        (nullable — NULL means currently active)

UNIQUE (group_id, user_id)
```

Key rule: **Never delete a row from this table.** Only set `left_at`.
Historical expenses must always be able to reference past members.

#### expenses
```
id                UUID        PRIMARY KEY
group_id          UUID        FK → groups.id
description       VARCHAR     NOT NULL
paid_by_user_id   UUID        FK → users.id  (nullable — for missing paid_by rows)
amount            DECIMAL(10,2)   NOT NULL    (original amount in original currency)
currency          VARCHAR(3)  NOT NULL DEFAULT 'INR'
amount_inr        DECIMAL(10,2)   NOT NULL    (always in INR for calculations)
exchange_rate     DECIMAL(10,4)   DEFAULT 1.0
split_type        VARCHAR     NOT NULL        (equal | unequal | percentage | share)
expense_date      TIMESTAMP   NOT NULL
is_settlement     BOOLEAN     DEFAULT false
import_row_number INT         (nullable — set for CSV-imported rows)
notes             TEXT
created_at        TIMESTAMP   DEFAULT now()
```

#### expense_splits
```
id             UUID         PRIMARY KEY
expense_id     UUID         FK → expenses.id
user_id        UUID         FK → users.id
amount_owed    DECIMAL(10,2) NOT NULL
split_ratio    DECIMAL(10,4) (nullable — for share type)
percentage     DECIMAL(5,2)  (nullable — for percentage type)
```

One row per person per expense. Balance for any user = sum of expenses they paid
minus sum of their `amount_owed` across all non-settlement expenses.

#### settlements
```
id               UUID        PRIMARY KEY
group_id         UUID        FK → groups.id
paid_by_user_id  UUID        FK → users.id
paid_to_user_id  UUID        FK → users.id
amount           DECIMAL(10,2) NOT NULL
currency         VARCHAR(3)  DEFAULT 'INR'
settlement_date  DATE        NOT NULL
notes            TEXT
created_at       TIMESTAMP   DEFAULT now()
```

Settlements recorded through the UI (not from CSV import) go here. These reduce
outstanding debts but are tracked separately from expenses.

#### import_sessions
```
id             UUID        PRIMARY KEY
group_id       UUID        FK → groups.id
imported_by    UUID        FK → users.id
filename       VARCHAR
total_rows     INT         DEFAULT 0
rows_imported  INT         DEFAULT 0
rows_skipped   INT         DEFAULT 0
rows_flagged   INT         DEFAULT 0
status         VARCHAR     (pending | completed | failed)
created_at     TIMESTAMP   DEFAULT now()
```

#### import_anomalies
```
id                UUID        PRIMARY KEY
session_id        UUID        FK → import_sessions.id
row_number        INT         NOT NULL
anomaly_type      VARCHAR     NOT NULL
raw_row_data      TEXT        (original CSV row stored verbatim)
description       TEXT        (human-readable explanation)
action_taken      VARCHAR     (auto_fixed | imported_with_warning | skipped |
                               imported_as_settlement | pending_approval)
resolution_notes  TEXT
requires_approval BOOLEAN     DEFAULT false
approved_by       UUID        FK → users.id (nullable)
approved_at       TIMESTAMP   (nullable)
created_at        TIMESTAMP   DEFAULT now()
```

---

### Entity Relationship Summary

```
users ←── group_memberships (joined_at, left_at) ──→ groups
users ←── expenses (paid_by_user_id) ──────────────→ groups
users ←── expense_splits ──────────────────────────→ expenses
users ←── settlements (paid_by, paid_to) ──────────→ groups
import_sessions ──→ groups
import_sessions ──→ users (imported_by)
import_anomalies ──→ import_sessions
import_anomalies ──→ users (approved_by)
```