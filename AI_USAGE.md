# AI_USAGE.md — AI Tool Usage Log

## Tools Used

**Primary:** Claude (Anthropic) — claude.ai web interface

Claude was used as the primary development collaborator throughout this project.
The AI generated initial code, helped reason through edge cases, and assisted with
designing the data import pipeline. Every file submitted was read, understood, and
verified by me before committing. Code the AI generated that I did not understand
was not submitted.

---

## How AI Was Used

| Area | What AI Helped With |
|---|---|
| Schema design | Reasoning through time-based membership, settlement separation |
| CSV analysis | Identifying data anomalies, categorizing by type |
| Importer pipeline | Structure of the row-processing loop, anomaly recording |
| Split calculator | Mathematical precision for each split type, rounding strategy |
| API route patterns | Next.js App Router route handler structure |
| Auth setup | NextAuth credentials provider configuration |
| Documentation | Drafting structure for SCOPE, DECISIONS, README |

---

## Key Prompts Used

**Prompt 1 — Schema Design**
> "I'm building a shared expenses app for flatmates. Members can join and leave over
> time. I need to track: who paid an expense, how it was split among people who were
> active at the time the expense was dated, and settlements between members separately
> from expenses. Design a PostgreSQL schema using Prisma that handles Meera leaving
> end of March and Sam joining mid-April without losing historical data."

**Prompt 2 — CSV Importer Structure**
> "Here is a CSV file with shared flat expenses. It contains deliberate data problems
> including duplicates, a settlement logged as an expense, amounts in USD mixed with
> INR, percentages that don't sum to 100%, missing fields, non-standard date formats,
> and a non-member in the split_with column. Build a TypeScript CSV importer that
> processes each row, detects every problem, and writes anomalies to a database table.
> A crashed import and a silent fix are both wrong answers."

**Prompt 3 — Balance Calculation**
> "Write a TypeScript function `calculateNetBalances` that takes an array of expenses
> with splits and an array of settlements, and returns each person's net balance.
> A positive balance means others owe them. A negative balance means they owe others.
> Then write `simplifyDebts` using a greedy algorithm to find the minimum number of
> transactions to settle all debts."

**Prompt 4 — Percentage Split Normalization**
> "Row 15 in my CSV has percentage splits: Aisha 30%, Rohan 30%, Priya 30%, Meera 20%.
> These sum to 110%. I want to normalize them to 100% proportionally rather than reject
> the row. Write the normalization logic and show me the resulting amounts for a
> ₹1,440 expense."

**Prompt 5 — NextAuth Type Augmentation**
> "In Next.js 14 with NextAuth v4 and JWT sessions, session.user.id is not typed by
> default. How do I augment the next-auth module types in TypeScript so that
> session.user.id is typed as a string without getting TypeScript errors in every
> API route?"

---

## Three Cases Where AI Produced Something Wrong

### Case 1 — Balance Calculator Ignored Membership Dates

**What the AI generated:**
```typescript
// AI's version — WRONG
export function calculateNetBalances(expenses, settlements, members) {
  const balances: Record<string, number> = {}
  
  for (const expense of expenses) {
    if (expense.isSettlement) continue
    // Credit the payer
    balances[expense.paidByUserId] += expense.amountInr
    // Debit each split member
    for (const split of expense.splits) {
      balances[split.userId] -= split.amountOwed
    }
  }
  return balances
}
```

**What was wrong:**
The AI calculated balances from all expense splits regardless of whether the member
was active on the expense date. This would charge Sam for March electricity (he joined
April 15) and charge Meera for April groceries (she left March 31). The balance
calculation itself doesn't need to filter by date — the importer already excludes
inactive members from splits at the time the expense is created. But I caught that the
importer was also not checking dates before I wired it up, and traced the root cause
back to the `isMemberOnDate` function being missing from the first draft. I added the
membership date check in the importer so the splits database table never contains
invalid rows to begin with.

**What I changed:**
Added `isMemberOnDate(userName, date)` to the importer that checks
`joinedAt <= expenseDate AND (leftAt IS NULL OR leftAt >= expenseDate)` before
creating any split row. The balance calculator then operates correctly because
the underlying data is clean.

---

### Case 2 — Prisma Decimal Treated as a Number

**What the AI generated:**
```typescript
// AI's version — WRONG
const totalOwed = expense.splits.reduce((sum, split) => {
  return sum + split.amountOwed  // ← Direct arithmetic on Prisma Decimal
}, 0)
```

**What was wrong:**
Prisma's `Decimal` type (used for `DECIMAL(10,2)` columns) is not a JavaScript number.
It is a Decimal.js object. Adding it directly to a number (0 in the accumulator) produces
`NaN`. In testing I got balances of `NaN` for every user and could not figure out why
at first. I ran `console.log(typeof expense.splits[0].amountOwed)` and got `"object"`,
which revealed the issue.

**What I changed:**
```typescript
// Corrected version
const totalOwed = expense.splits.reduce((sum, split) => {
  return sum + parseFloat(split.amountOwed.toString())
}, 0)
```

Added this conversion in every place Prisma Decimal values are used in arithmetic:
balance calculator, split calculator validation, and any API response that formats
amounts as numbers.

---

### Case 3 — The Duplicate Detection Missed the Thalassa Case

**What the AI generated:**
```typescript
// AI's version — only detected exact duplicates
const dupKey = `${date}|${paidByName}|${amount}`
if (seenKeys.has(dupKey)) {
  // flag as duplicate
}
seenKeys.add(dupKey)
```

**What was wrong:**
This only catches the Marina Bites duplicate (same date, same payer, same amount).
The Thalassa dinner case (rows 24 and 25) has the same date but different payers
(Aisha vs Rohan) and different amounts (₹2,400 vs ₹2,450). The AI's algorithm
imported both Thalassa rows without any warning, which would double-count ₹4,850
worth of dinner.

**How I caught it:**
I manually walked through the CSV after the importer ran and checked the expenses
list. I noticed two dinner entries for March 11 with similar names and amounts.
I searched my own import code and confirmed that `seenKeys` would never match on
these rows because the payer and amount differ.

**What I changed:**
Added a secondary description-similarity check using `seenDescriptions` — an array
of `{ row, date, description, amount }` objects. After the exact duplicate check,
the importer also checks if any previously-seen expense on the same date has a
description that shares the first word with the current row's description. If so,
it flags both as a near-duplicate and imports with a warning rather than silently
accepting both. The Thalassa case triggers this check correctly.

```typescript
// Added secondary check
const similarDesc = seenDescriptions.find(
  (s) =>
    s.date === expenseDate &&
    (s.desc.toLowerCase().includes(descFirstWord) ||
      descLower.includes(s.desc.toLowerCase().split(' ')[0]))
)
if (similarDesc) {
  rowAnomalies.push(`Similar to row ${similarDesc.row} on same date — possible duplicate`)
}
seenDescriptions.push({ row: rowNumber, date: expenseDate, desc: description, amount })
```