# DECISIONS.md — Engineering and Product Decision Log

Every significant decision made during the design and build of this application is
documented here. Format: decision made → options considered → rationale.

---

## Decision 1 — Fixed USD Exchange Rate vs Live API

**Decision:** Use a hardcoded fixed rate of ₹83.5 per USD for all USD → INR conversions.

**Options considered:**
- **Live exchange rate API** (e.g., Open Exchange Rates, Fixer.io): Always returns the
  current rate. Free tiers available.
- **Fixed historical rate**: One rate hardcoded for the period of the Goa trip (March 2026).
- **Rate per expense date**: Store a rate per date, fetch from an API during import.

**Why fixed rate:**
All USD expenses in this CSV are from a single trip (Goa, March 8–14, 2026). These are
historical transactions. If we used a live rate, the balances would change every time someone
opened the app — Aisha's balance in March would be different in June. That's incorrect
behaviour for historical data. A fixed rate at ₹83.5 (the approximate rate during the Goa
trip in March 2026) produces a stable, auditable result. The rate used is stored per expense
(`exchange_rate` column) so it is always traceable. If the group disputes the rate, they can
see exactly what was used.

---

## Decision 2 — Settlements: Separate Table vs Flag on Expenses Table

**Decision:** Settlements created through the UI go into the `settlements` table.
Settlement rows found in the CSV import are stored in the `expenses` table with
`is_settlement = true`.

**Options considered:**
- **Settlements only in expenses table with a flag**: One table for everything,
  filter by `is_settlement`.
- **Settlements only in a separate table**: Clean separation, but CSV settlement
  rows would either be rejected or lose their import audit trail.
- **Hybrid (chosen)**: CSV rows that are settlements go into `expenses` with
  `is_settlement = true` to preserve import history. New settlements created
  through the UI go into the dedicated `settlements` table.

**Why hybrid:**
The import audit trail must be complete. Spreetail's requirements say every anomaly
must be detected and handled — silently rejecting CSV rows loses that history. Storing
them in `expenses` with the flag preserves the raw data while the flag ensures they
are excluded from all balance calculations. New UI-created settlements are cleaner —
they go directly into `settlements` with a proper `paid_by` / `paid_to` structure.

---

## Decision 3 — Time-Based Membership: Date Range vs Event Log

**Decision:** Use a `joined_at` + `left_at` date range on the `group_memberships` table.

**Options considered:**
- **Boolean `is_active` flag**: Simple, but loses history. Cannot answer "Was Meera
  a member on March 15?"
- **Event log table**: Separate rows for each join/leave event. More flexible but
  more complex to query.
- **Date range on membership row (chosen)**: `joined_at` and `left_at` on the same
  row. `left_at = NULL` means currently active.

**Why date range:**
Sam's complaint — "Why would March electricity affect my balance?" — is only answerable
if we can query membership by date. The date range approach answers it with one SQL
condition: `joined_at <= expense_date AND (left_at IS NULL OR left_at >= expense_date)`.
Event logs add complexity without benefit for this use case since there is only one
active membership per person per group at any time.

**Critical rule enforced:** Membership rows are never deleted. Only `left_at` is set.
This ensures all historical expense splits remain valid — a split references a `user_id`
and the membership record always exists to provide context.

---

## Decision 4 — Store Both Original Amount and INR Amount

**Decision:** Store `amount` (original), `currency`, `amount_inr` (converted), and
`exchange_rate` on every expense row.

**Options considered:**
- **Store only INR**: Simpler schema, but original USD amounts are lost forever.
- **Store only original currency**: Cannot do INR balance calculations directly.
- **Store both (chosen)**: Original is preserved, INR is used for all calculations.

**Why both:**
Priya's complaint was explicit: "The sheet pretends a dollar is a rupee. That can't be
right." If we converted to INR and discarded the original, Priya would see ₹540 instead
of the correct ₹45,090 — and she could not even verify the conversion happened. Storing
the original `amount`, the `currency`, the `amount_inr`, and the `exchange_rate` makes
every conversion fully auditable. Balance calculations always use `amount_inr`.

---

## Decision 5 — Duplicate Detection Algorithm

**Decision:** Use a composite key of (date + paid_by + amount) for exact duplicate
detection, and a secondary description-similarity check for near-duplicates.

**Options considered:**
- **Exact row match only**: Would miss the Thalassa dinner case (same date, similar
  description, different amounts).
- **Description similarity only**: Too aggressive — "Groceries BigBasket" and "Groceries
  DMart" on different dates should not be flagged.
- **Composite key + description similarity (chosen)**: Exact key catches Marina Bites.
  Same-date description overlap catches Thalassa.

**Why this approach:**
The CSV has two distinct duplicate patterns. Marina Bites (rows 5 & 6) is an exact
duplicate — same date, payer, and amount. Thalassa (rows 24 & 25) is a near-duplicate —
same date, similar description, different amounts and payers. Using only one detection
method would miss one of the two patterns. Both are surfaced to the user — neither is
silently deleted. Meera's requirement was explicit: "I want to approve anything the app
deletes or changes."

---

## Decision 6 — Percentage Overflow: Normalize vs Reject

**Decision:** When percentages sum to more or less than 100%, normalize them
proportionally and import with a warning. Do not reject the row.

**Options considered:**
- **Reject the row**: Clean, but loses the expense entirely. The expense is real even
  if the percentages are wrong.
- **Import as equal split instead**: Loses the intended split logic entirely.
- **Normalize proportionally (chosen)**: Divide each percentage by the total sum and
  multiply by 100. `110%` total → each percentage divided by 1.1.

**Why normalize:**
The Pizza Friday expense (row 15) is real — ₹1,440 was spent. Rejecting it because the
percentages are off by 10% penalizes the group for a data entry mistake. Normalizing to
100% preserves the intent (Meera pays roughly two-thirds of what others pay) while
making the math valid. The normalization is logged as an anomaly so the group can review
it.

---

## Decision 7 — Kabir (Non-Member) in Expense Splits

**Decision:** Exclude Kabir from all splits and redistribute his share equally among
the remaining valid members.

**Options considered:**
- **Reject the entire expense**: Loses a legitimate ₹12,525 USD expense.
- **Create a guest user account for Kabir**: He has no email, no login, no ongoing
  relationship with the flat.
- **Redistribute his share (chosen)**: Kabir's portion (1/5 of the parasailing cost)
  is divided equally among the four flat members. They settle with Kabir offline.

**Why redistribute:**
The four flatmates are the ones being tracked. Kabir joined for one activity and has
no account in the system. Creating a ghost user would pollute the member list and
the balance summary. Redistributing is the pragmatic choice and is clearly documented
in the import report so the group knows Kabir's share was absorbed.

---

## Decision 8 — Ambiguous Date 04-05-2026

**Decision:** Interpret row 34's date as April 5, 2026 (DD-MM-YYYY format).

**Options considered:**
- **Reject the row**: The expense is real (₹2,500 deep cleaning service).
- **Interpret as May 4, 2026**: Possible under MM-DD-YYYY format.
- **Interpret as April 5, 2026 (chosen)**: Supported by context clues.

**Why April 5:**
The `split_with` column contains Aisha, Rohan, Priya — but not Sam (who joined
April 15). If this were a May 4 expense, Sam would almost certainly be included
since he joined April 15. His absence suggests this predates April 15, making
April 5 the consistent interpretation. This is still flagged as ambiguous so the
group can override it.

---

## Decision 9 — Rounding Rule for Split Calculations

**Decision:** Round individual splits to 2 decimal places (paisa precision) using
half-up rounding. Assign any remainder to the last member in the split list.

**Options considered:**
- **Round each split independently**: Can cause sums to be off by 1–2 paisa.
- **Floor all splits, add remainder to payer**: Asymmetric, benefits the payer.
- **Last-member remainder absorption (chosen)**: Calculate N-1 members with normal
  rounding, last member gets `total - sum(others)`.

**Why last-member remainder:**
`₹1,000 / 3 = 333.333...` — any rounding strategy loses a paisa somewhere.
The last-member approach guarantees the splits always sum exactly to the total.
The maximum error per person is ±1 paisa (less than 2 paise on any expense).
This is consistent, auditable, and standard practice in expense-splitting apps.

---

## Decision 10 — Zero Amount Expenses: Skip vs Flag

**Decision:** Skip zero-amount expenses entirely and log them.

**Options considered:**
- **Import as a ₹0 expense**: Creates split rows where everyone owes ₹0. Noise.
- **Reject with error**: The row exists for a reason (the notes explain it).
- **Skip and log (chosen)**: The expense is excluded from balances but the anomaly
  is recorded so the import report shows it was seen and handled.

**Why skip:**
Row 31 (Swiggy, ₹0) has notes saying "counted twice earlier - fixing later". It is
a deliberate placeholder, not a real expense. Importing it adds zero to any balance
while polluting the expense list. Skipping it and recording the reason in the import
report gives the group full visibility without the noise.

---

## Decision 11 — Sam's Pre-Join-Date Expenses (Rows 39 and 40)

**Decision:** Import Sam into splits for April 10 and April 12 expenses with a
warning, despite his official `joined_at` being April 15.

**Options considered:**
- **Exclude Sam strictly**: Correct by the date rule, but penalizes the group's intent.
- **Include Sam with a warning (chosen)**: The housewarming party (row 39) is for
  Sam's arrival — excluding him from his own welcome party makes no sense. Electricity
  (row 40) is less clear but the group clearly meant to include him.

**Why include:**
The membership date rule exists to prevent accidental inclusion (like Meera in April).
Sam's case is intentional inclusion before the official join date. The group plainly
meant for Sam to be in these expenses. Silently excluding him would produce incorrect
balances without the group knowing why. Including him with a warning gives the group
the correct result while making the decision visible.

---

## Decision 12 — Split Type Conflict on Row 42

**Decision:** When `split_type = equal` but `split_details` contains share ratios,
prefer the split_details and change split_type to `share`.

**Options considered:**
- **Trust split_type, ignore split_details**: The ratios are all 1:1:1:1, so the
  result is the same as equal — but we lose the intent.
- **Trust split_details, update split_type (chosen)**: More specific data wins.

**Why split_details wins:**
The notes explicitly say "split_type says equal but someone added shares anyway."
The person who added the shares had more specific intent than whoever set the type.
In this particular case the result is identical (all ratios are 1), but the principle
is: when two fields conflict, the more specific field wins. This is documented so the
group can verify the logic.

---

## Decision 13 — Thalassa Dinner (Rows 24 & 25): Import Both vs Choose One

**Decision:** Import both rows with a warning rather than picking one.

**Options considered:**
- **Pick the lower amount (row 24)**: Arbitrary.
- **Pick the one with more complete notes (row 25)**: Row 25 notes say Aisha's
  might be wrong — but that note was written by Rohan about Aisha's entry.
- **Import both with warning (chosen)**: Let the group decide.

**Why import both:**
Meera's requirement: "I want to approve anything the app deletes or changes."
Choosing one programmatically would mean silently deleting real financial data.
Both rows appear in the import report as potential duplicates. The group can
delete the incorrect one through the app's expense management UI after reviewing
their receipts.

---

## Decision 14 — Session Strategy: JWT vs Database Sessions

**Decision:** Use JWT sessions (`strategy: 'jwt'` in NextAuth).

**Options considered:**
- **Database sessions**: NextAuth stores sessions in a `sessions` table. Requires
  the `@auth/prisma-adapter` and additional schema tables.
- **JWT sessions (chosen)**: Session data lives in a signed cookie. No extra tables.

**Why JWT:**
This application has a small, fixed user base (6 seeded users). The overhead of
database session management adds schema complexity without meaningful benefit.
JWT sessions are stateless — the session is verified by the `NEXTAUTH_SECRET` on
every request, which is appropriate for this scale.