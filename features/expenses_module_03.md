# Expenses Module — AI Build Prompt

## Your Role
You are a senior full-stack engineer. Your task is to build the complete Expenses
Module for this project. Some files related to this module may already exist —
read every existing file before writing anything. If something already exists but
is broken, incomplete, or inconsistent with the stack, fix it. Do not assume any
file is correct just because it exists.

---

## Tech Stack (Do Not Change Any of These)

| Layer | Choice |
|---|---|
| Framework | Next.js 14 with App Router |
| Language | TypeScript (strict) |
| Database | PostgreSQL via Supabase |
| ORM | Prisma 6 |
| Authentication | NextAuth.js v4 |
| Styling | Tailwind CSS |
| Form Handling | react-hook-form |
| Validation | zod + @hookform/resolvers |
| Icons | lucide-react |
| Notifications | react-hot-toast |
| Date Formatting | date-fns |
| Package Manager | pnpm |

---

## Prisma Schema Reference

These models already exist in `prisma/schema.prisma`.
Do not modify the schema. Use these exact field names in all queries.

```prisma
model Expense {
  id               String   @id @default(uuid(4))
  groupId          String
  description      String
  paidByUserId     String?
  amount           Decimal  @db.Decimal(10, 2)
  currency         String   @default("INR")
  amountInr        Decimal  @db.Decimal(10, 2)
  exchangeRate     Decimal  @default(1.0) @db.Decimal(10, 4)
  splitType        String
  expenseDate      DateTime
  isSettlement     Boolean  @default(false)
  importRowNumber  Int?
  notes            String?
  createdAt        DateTime @default(now())

  group       Group          @relation(fields: [groupId], references: [id])
  paidBy      User?          @relation("ExpensePaidBy", fields: [paidByUserId], references: [id])
  splits      ExpenseSplit[]
}

model ExpenseSplit {
  id          String   @id @default(uuid(4))
  expenseId   String
  userId      String
  amountOwed  Decimal  @db.Decimal(10, 2)
  splitRatio  Decimal? @db.Decimal(10, 4)
  percentage  Decimal? @db.Decimal(5, 2)

  expense Expense @relation(fields: [expenseId], references: [id])
  user    User    @relation(fields: [userId], references: [id])
}

model GroupMembership {
  id       String    @id @default(uuid(4))
  groupId  String
  userId   String
  joinedAt DateTime
  leftAt   DateTime?

  group Group @relation(fields: [groupId], references: [id])
  user  User  @relation(fields: [userId], references: [id])
}
```

Import the Prisma client exactly like this:
```typescript
import { prisma } from '@/lib/prisma'
```

---

## Critical Business Logic — Read This Before Writing Any Code

### The Four Split Types

Every expense has a `splitType` field. All four types below appear in the real
CSV data that will be imported. Your form and API must handle all four correctly.

---

**Type 1: equal**

The total is divided equally among all selected members.
Rounding rule: divide to 2 decimal places. The last person absorbs any remainder
caused by rounding so the splits always sum exactly to the total.

```
Expense: ₹1,199 split equally among 4 people
Per person raw: 1199 / 4 = 299.75
Splits: Aisha 299.75, Rohan 299.75, Priya 299.75, Meera 299.75
Sum check: 299.75 × 4 = 1199.00 ✓ (clean in this case)

Expense: ₹1,000 split equally among 3 people
Per person raw: 1000 / 3 = 333.333...
Splits: Aisha 333.33, Rohan 333.33, Priya 333.34 (last person gets the extra paisa)
Sum check: 333.33 + 333.33 + 333.34 = 1000.00 ✓
```

---

**Type 2: unequal**

Each person's exact amount is specified. The amounts must sum to the total expense.
This is used when one person's share is explicitly different from others.

```
Expense: ₹1,500 Aisha birthday cake (Aisha not charged)
splitDetails: "Rohan 700; Priya 400; Meera 400"
Splits: Rohan 700, Priya 400, Meera 400
Sum check: 700 + 400 + 400 = 1500 ✓
```

The `split_with` column lists who is involved. The `split_details` column provides
the per-person amounts in the format: `Name Amount; Name Amount; Name Amount`

On the form, when unequal is selected, show one amount input per selected member.
Validate that all amounts are filled in and their sum equals the total amount.

---

**Type 3: percentage**

Each person's share is specified as a percentage. The percentages must sum to 100%.
The actual amount owed per person = (percentage / 100) × total.

```
Expense: ₹1,440 Pizza Friday
splitDetails: "Aisha 30%; Rohan 30%; Priya 30%; Meera 20%"

BUT: 30 + 30 + 30 + 20 = 110 ← This is a real anomaly from the CSV

Policy for invalid percentages: Normalize by dividing each by the total sum.
  Normalized: Aisha 27.27%, Rohan 27.27%, Priya 27.27%, Meera 18.18% (sum = 100%)

For the ADD EXPENSE FORM: Do not allow submission if percentages do not sum to 100%.
Show a live running total and a red error until the sum equals exactly 100.

For the IMPORT: Normalize silently and log as anomaly (already handled in importer).
```

Rounding: same as equal — last person absorbs any remainder.

---

**Type 4: share**

Each person is assigned a ratio (a positive integer or decimal). Their share of
the total is proportional to their ratio relative to the sum of all ratios.

```
Expense: ₹3,600 Scooter rentals
splitDetails: "Aisha 1; Rohan 2; Priya 1; Dev 2"
Total ratio: 1 + 2 + 1 + 2 = 6

Aisha: (1/6) × 3600 = 600
Rohan: (2/6) × 3600 = 1200
Priya: (1/6) × 3600 = 600
Dev:   (2/6) × 3600 = 1200
Sum:   600 + 1200 + 600 + 1200 = 3600 ✓
```

This is used when people use different amounts of something
(e.g., Rohan and Dev took bigger scooters).

---

### Currency Handling

Expenses can be in INR or USD. The database stores both the original amount
and the converted INR amount.

```
amount        ← original value in original currency (e.g., 540)
currency      ← original currency (e.g., 'USD')
amountInr     ← converted value in INR (e.g., 45090)
exchangeRate  ← rate used for conversion (e.g., 83.5)
```

**Fixed exchange rate for this project:**
```typescript
export const USD_TO_INR_RATE = 83.5
```

This is hardcoded because all expenses are historical. A live rate would give a
different number each time the app is opened. Document this in DECISIONS.md.

When a user adds a USD expense:
- Store `amount = 540`, `currency = 'USD'`
- Store `amountInr = 540 × 83.5 = 45090`, `exchangeRate = 83.5`
- All balance calculations use `amountInr`, never `amount` for USD rows

When a user adds an INR expense:
- Store `amount = 48000`, `currency = 'INR'`
- Store `amountInr = 48000`, `exchangeRate = 1.0`

---

### Member Filtering by Date

When a user picks an expense date on the form, the "Split With" member selector
must only show members who were active in the group on that date.

```
Active on date = joinedAt <= expenseDate AND (leftAt IS NULL OR leftAt >= expenseDate)
```

This prevents Sam (joined April 15) from appearing in a March expense.
This prevents Meera (left March 31) from appearing in an April expense.

Implement this filter on both the client (for the form dropdown) and the server
(when saving — validate that all submitted userIds were active on the expense date).

---

### Settlement Flag

The `isSettlement` field marks rows that are repayments, not real expenses.
Examples: "Rohan paid Aisha back", "Sam deposit share".

Rules for this flag:
- Settlement rows must NOT appear in the main expenses list
- Settlement rows must NOT be included in balance calculations
- Settlement rows exist in the expenses table only to preserve import history
- When a user adds a new expense manually, `isSettlement` is always `false`
- The import module sets this flag — the expense form does not expose it

---

## What You Must Build

---

### File 1: `app/api/groups/[groupId]/expenses/route.ts`

Handles listing expenses and creating a new expense.

**GET /api/groups/[groupId]/expenses**

Query params (all optional):
- `?excludeSettlements=true` — exclude rows where `isSettlement = true` (default behaviour)
- `?member=userId` — only expenses where this user has a split
- `?from=YYYY-MM-DD` — expenses on or after this date
- `?to=YYYY-MM-DD` — expenses on or before this date
- `?currency=USD` — only USD expenses

What it must do:
- Verify current user is a member of this group (return 403 if not)
- Build the Prisma `where` clause dynamically based on query params
- By default exclude settlement rows (`isSettlement: false`)
- Include splits with user details in response
- Include paidBy user details in response
- Order by `expenseDate` descending (most recent first)
- Return array of expenses

```typescript
// Include shape:
include: {
  paidBy: {
    select: { id: true, name: true, email: true }
  },
  splits: {
    include: {
      user: {
        select: { id: true, name: true }
      }
    }
  }
}
```

**POST /api/groups/[groupId]/expenses**

Body:
```typescript
{
  description: string
  expenseDate: string          // ISO date string
  paidByUserId: string
  amount: number
  currency: 'INR' | 'USD'
  splitType: 'equal' | 'unequal' | 'percentage' | 'share'
  splitWith: string[]          // array of userIds
  splitDetails: Array<{
    userId: string
    amountOwed?: number        // for unequal
    percentage?: number        // for percentage
    splitRatio?: number        // for share
  }>
  notes?: string
}
```

What it must do:
- Verify current user is a member of this group
- Validate all required fields are present
- Validate `splitType` is one of the four valid types
- Validate all `splitWith` userIds were active members on `expenseDate`
  (check against GroupMembership — return 400 if any are invalid)
- Calculate `amountInr` and `exchangeRate` based on currency
- For equal splits: calculate `amountOwed` per person server-side
  (do not trust the client's calculation — recalculate on the server)
- For unequal splits: validate that sum of `amountOwed` equals `amountInr`
  (allow 1 paisa tolerance for rounding: `Math.abs(sum - total) <= 0.01`)
- For percentage splits: validate percentages sum to 100
  (allow 0.01 tolerance)
- For share splits: calculate `amountOwed` from ratios server-side
- Use a Prisma transaction to create the expense and all splits atomically
- Return 201 with the created expense including splits

```typescript
// Transaction pattern:
const result = await prisma.$transaction(async (tx) => {
  const expense = await tx.expense.create({
    data: {
      groupId,
      description,
      paidByUserId,
      amount,
      currency,
      amountInr,
      exchangeRate,
      splitType,
      expenseDate: new Date(expenseDate),
      notes,
      isSettlement: false,
    }
  })

  await tx.expenseSplit.createMany({
    data: splits.map(s => ({
      expenseId: expense.id,
      userId: s.userId,
      amountOwed: s.amountOwed,
      percentage: s.percentage ?? null,
      splitRatio: s.splitRatio ?? null,
    }))
  })

  return expense
})
```

---

### File 2: `app/api/groups/[groupId]/expenses/[expenseId]/route.ts`

Handles reading, updating, and deleting a single expense.

**GET /api/groups/[groupId]/expenses/[expenseId]**

What it must do:
- Verify current user is a member of this group
- Return the expense with full split details and paidBy user
- Return 404 if expense does not exist or does not belong to this group

**PATCH /api/groups/[groupId]/expenses/[expenseId]**

Body: same shape as POST body, all fields optional

What it must do:
- Verify current user is the one who paid this expense OR is the group creator
  (only the payer or group creator can edit)
- Return 403 if neither
- If amount, splitType, splitWith, or splitDetails changed:
  - Delete all existing ExpenseSplit rows for this expense
  - Recalculate and recreate splits
  - Do this in a transaction
- If only description, notes, or date changed:
  - Update expense row only (splits unchanged)
- Recalculate `amountInr` if currency or amount changed
- Return updated expense with splits

**DELETE /api/groups/[groupId]/expenses/[expenseId]**

What it must do:
- Verify current user is the payer OR group creator
- Return 403 if neither
- Delete all ExpenseSplit rows first (or use cascade if configured)
- Delete the Expense row
- Return 200 with `{ message: 'Expense deleted' }`

---

### File 3: `app/(dashboard)/groups/[groupId]/expenses/page.tsx`

The expenses list page for a group.

What it must do:
- Be a server component
- Get session, redirect if not authenticated
- Fetch expenses from the API or directly via Prisma
- Exclude settlement rows by default
- Show a header with: "Expenses" title, total expense count, "Add Expense" button
- Show the filter bar (see below)
- Show the expense list using `ExpenseList` component
- Show empty state if no expenses: "No expenses yet. Add the first one."

**Filter bar must include:**
- Date range: "From" and "To" date inputs
- Member filter: dropdown of all members (shows only their expenses)
- Currency filter: "All", "INR only", "USD only" toggle
- Clear filters button

Filters update the URL search params and the page re-fetches.

---

### File 4: `components/expenses/ExpenseList.tsx`

Renders the list of expenses grouped by month.

Props:
```typescript
type ExpenseListProps = {
  expenses: ExpenseWithSplits[]
  currentUserId: string
  groupMembers: { id: string; name: string }[]
  onEdit: (expense: ExpenseWithSplits) => void
  onDelete: (expenseId: string) => void
}
```

What it must render:
- Expenses grouped by month with a month heading: "March 2026"
- Within each month, expenses ordered by date descending
- Each expense row (see ExpenseRow below)
- A month subtotal at the end of each group: "March total: ₹ 45,230"

---

### File 5: `components/expenses/ExpenseRow.tsx`

Renders a single expense in the list.

Props:
```typescript
type ExpenseRowProps = {
  expense: ExpenseWithSplits
  currentUserId: string
  onEdit: () => void
  onDelete: () => void
}
```

What it must render:
- Left section:
  - Description (bold)
  - Date in format "Mar 11, 2026"
  - Notes (if present, italic muted text, truncated)
- Center section:
  - "Paid by [Name]" with avatar circle
  - Split type badge: small colored pill showing "equal" / "unequal" / "percentage" / "share"
  - If USD: show "USD" badge next to amount
- Right section:
  - Total amount: "₹ 2,400" (always show in INR)
  - If USD original: show "($ 540)" in smaller muted text below
  - Your share pill: 
    - If current user paid: green pill "You paid ₹ 2,400"
    - If current user owes: orange pill "You owe ₹ 600"
    - If current user has no split in this expense: grey pill "Not involved"
- Actions (show on hover or always on mobile):
  - Edit icon button
  - Delete icon button

**Expand on click:**
Clicking anywhere on the row (except action buttons) expands it to show a full
breakdown of all splits:

```
Who splits this expense:
  Aisha    ₹ 600   (you)
  Rohan    ₹ 600
  Priya    ₹ 600
  Dev      ₹ 600
  ─────────────
  Total    ₹ 2,400
```

For percentage split: show "Aisha 30% → ₹ 432"
For share split: show "Rohan 2 shares → ₹ 1,200"

---

### File 6: `components/expenses/ExpenseForm.tsx`

The most complex component in this module. Used for both adding and editing expenses.

This must be a client component (`'use client'`).

Props:
```typescript
type ExpenseFormProps = {
  groupId: string
  members: Array<{
    id: string
    name: string
    joinedAt: Date
    leftAt: Date | null
  }>
  defaultValues?: Partial<ExpenseFormValues>
  onSubmit: (data: ExpenseFormValues) => Promise<void>
  onCancel: () => void
  isLoading: boolean
  mode: 'create' | 'edit'
}
```

**Form fields in exact order:**

**Field 1 — Description**
- Text input, required
- Placeholder: "e.g. February rent, Groceries, Dinner"
- Max 200 characters

**Field 2 — Date**
- Date input (type="date")
- Required
- Default: today
- On change: IMMEDIATELY recalculate the available members in "Split With"
  based on who was active in the group on the new date
  (filter `members` prop by `joinedAt <= date && (leftAt == null || leftAt >= date)`)

**Field 3 — Paid By**
- Dropdown (select element)
- Options: all members currently active on the selected date
- Required
- Default: current logged-in user

**Field 4 — Amount**
- Number input, required, min 0.01
- Show currency symbol prefix (₹ or $) based on selected currency

**Field 5 — Currency**
- Toggle or select: INR | USD
- Default: INR
- When switched to USD: show an info text below:
  "Will be converted at ₹83.5 per USD. Stored in INR as ₹[calculated amount]"
  Update this dynamically as the user types the amount.

**Field 6 — Split Type**
- Select dropdown with options: Equal | Unequal | Percentage | Share
- Default: Equal
- Changing this triggers the conditional split details section below

**Field 7 — Split With**
- Multi-select checklist of members active on the selected date
- Show member name + "joined Feb 1" in small muted text
- All active members checked by default when date is set
- At least 1 member must be selected
- When members are checked/unchecked: recalculate the split preview

**Field 8 — Split Details (conditional, shown for non-equal splits)**

This section changes based on `splitType`:

*For UNEQUAL:*
For each selected member, show an amount input:
```
Rohan  [   700  ] ₹
Priya  [   400  ] ₹
Meera  [   400  ] ₹
──────────────────────
Total  [  1500  ] ← this must match the expense amount
Remaining: ₹ 0  ← goes red if not 0
```
- Show a running "Remaining" counter that subtracts filled amounts from total
- Disable submit if remaining != 0

*For PERCENTAGE:*
For each selected member, show a percentage input:
```
Aisha  [  30  ] %
Rohan  [  30  ] %
Priya  [  30  ] %
Meera  [  20  ] %
──────────────────
Total: 110% ← red when != 100%
```
- Show running total of percentages
- Turn red and show error "Percentages must sum to 100%" when not exactly 100
- Disable submit until exactly 100%
- Show calculated rupee amount next to each percentage:
  "Aisha 30% → ₹ 432.00"

*For SHARE:*
For each selected member, show a ratio input (positive number):
```
Aisha  [  1  ] shares
Rohan  [  2  ] shares  → ₹ 1,200
Priya  [  1  ] shares  → ₹ 600
Dev    [  2  ] shares  → ₹ 1,200
────────────────────────
Total shares: 6
```
- Default ratio: 1 for each member
- Show calculated rupee amount per person dynamically as ratios change
- All ratios must be > 0

**Field 9 — Notes**
- Textarea, optional
- 3 rows
- Max 500 characters

**Field 10 — Split Preview (always visible)**
Show a live summary box at the bottom of the form that updates as the user
makes changes. This gives the user confidence before saving:

```
Split Preview
─────────────────────────────────────
  Aisha     ₹  600.00    (you paid)
  Rohan     ₹  600.00    owes you
  Priya     ₹  600.00    owes you
  Dev       ₹  600.00    owes you
─────────────────────────────────────
  Total     ₹ 2,400.00
```

**Submit button:**
- Label: "Add Expense" in create mode, "Save Changes" in edit mode
- Disabled if:
  - Any required field is empty
  - Percentage sum != 100 (for percentage split)
  - Unequal amounts don't sum to total
  - No members selected in Split With
- Show loading spinner while submitting

---

### File 7: `components/expenses/AddExpenseModal.tsx`

Modal wrapper that contains the `ExpenseForm`.

Props:
```typescript
type AddExpenseModalProps = {
  isOpen: boolean
  onClose: () => void
  groupId: string
  members: GroupMembership[]
  onSuccess: () => void
}
```

What it must do:
- Show `ExpenseForm` inside a modal overlay
- On form submit: POST to `/api/groups/[groupId]/expenses`
- On success: call `onSuccess()` (triggers page refresh), call `onClose()`
- On error: show error toast and keep modal open
- Modal must be scrollable for smaller screens (the form is long)

---

### File 8: `components/expenses/EditExpenseModal.tsx`

Same as AddExpenseModal but for editing.

Props:
```typescript
type EditExpenseModalProps = {
  isOpen: boolean
  onClose: () => void
  groupId: string
  expense: ExpenseWithSplits | null
  members: GroupMembership[]
  onSuccess: () => void
}
```

What it must do:
- Pre-populate `ExpenseForm` with existing expense values
- On form submit: PATCH to `/api/groups/[groupId]/expenses/[expenseId]`
- On success: refresh and close

---

### File 9: `components/expenses/DeleteExpenseDialog.tsx`

Confirmation dialog before deleting an expense.

Props:
```typescript
type DeleteExpenseDialogProps = {
  isOpen: boolean
  onClose: () => void
  expense: { id: string; description: string; amountInr: number } | null
  groupId: string
  onSuccess: () => void
}
```

What it must render:
- Warning icon
- "Delete this expense?" heading
- "Deleting [description] (₹ [amount]) will recalculate all balances in the group."
- Cancel and Delete (red) buttons
- On confirm: DELETE to `/api/groups/[groupId]/expenses/[expenseId]`
- Show loading on Delete button while request is in progress
- On success: call `onSuccess()` and `onClose()`

---

### File 10: `lib/splitCalculator.ts`

Pure TypeScript utility. No database calls. No React. Receives data and returns results.
This file is used by both the API routes (server-side) and the form (client-side preview).

**Export these four functions:**

```typescript
export function calculateEqualSplit(
  totalAmountInr: number,
  memberIds: string[]
): Record<string, number>
// Returns { userId: amountOwed }
// Last member absorbs rounding remainder

export function calculateUnequalSplit(
  totalAmountInr: number,
  splits: Array<{ userId: string; amountOwed: number }>
): { result: Record<string, number>; isValid: boolean; diff: number }
// isValid = Math.abs(sum - total) <= 0.01
// diff = total - sum (for showing "Remaining" on the form)

export function calculatePercentageSplit(
  totalAmountInr: number,
  splits: Array<{ userId: string; percentage: number }>
): { result: Record<string, number>; isValid: boolean; totalPercentage: number }
// isValid = Math.abs(totalPercentage - 100) <= 0.01
// Last member absorbs rounding remainder

export function calculateShareSplit(
  totalAmountInr: number,
  splits: Array<{ userId: string; ratio: number }>
): Record<string, number>
// result[userId] = (ratio / totalRatio) * totalAmountInr
// Last member absorbs rounding remainder
```

**Rounding rule used in every function:**
```typescript
// Round to 2 decimal places
const rounded = Math.round(value * 100) / 100

// Last person absorbs remainder pattern:
let runningSum = 0
items.forEach((item, i) => {
  if (i === items.length - 1) {
    result[item.id] = Math.round((total - runningSum) * 100) / 100
  } else {
    const amount = Math.round((item.share * total) * 100) / 100
    result[item.id] = amount
    runningSum += amount
  }
})
```

---

### File 11: `types/expenses.ts`

Shared TypeScript types for this module. Import these across all expense components
and API routes.

```typescript
import { Expense, ExpenseSplit, User } from '@prisma/client'

export type ExpenseSplitWithUser = ExpenseSplit & {
  user: Pick<User, 'id' | 'name'>
}

export type ExpenseWithSplits = Expense & {
  paidBy: Pick<User, 'id' | 'name' | 'email'> | null
  splits: ExpenseSplitWithUser[]
}

export type SplitType = 'equal' | 'unequal' | 'percentage' | 'share'

export type ExpenseFormValues = {
  description: string
  expenseDate: string
  paidByUserId: string
  amount: number
  currency: 'INR' | 'USD'
  splitType: SplitType
  splitWith: string[]
  splitDetails: Array<{
    userId: string
    amountOwed?: number
    percentage?: number
    splitRatio?: number
  }>
  notes?: string
}
```

---

## Zod Validation Schemas

Use these exact schemas in the API routes and form. Do not invent different ones.

```typescript
const createExpenseSchema = z.object({
  description: z.string().min(1, 'Description is required').max(200),
  expenseDate: z.string().min(1, 'Date is required'),
  paidByUserId: z.string().min(1, 'Paid by is required'),
  amount: z.number().positive('Amount must be greater than 0'),
  currency: z.enum(['INR', 'USD']),
  splitType: z.enum(['equal', 'unequal', 'percentage', 'share']),
  splitWith: z.array(z.string()).min(1, 'At least one member must be selected'),
  splitDetails: z.array(z.object({
    userId: z.string(),
    amountOwed: z.number().optional(),
    percentage: z.number().min(0).max(100).optional(),
    splitRatio: z.number().positive().optional(),
  })),
  notes: z.string().max(500).optional(),
})
```

---

## Design Requirements

Use the same dark theme as the rest of the app.

**Split type badge colors:**
```
equal       → bg-blue-900 text-blue-300
unequal     → bg-purple-900 text-purple-300
percentage  → bg-yellow-900 text-yellow-300
share       → bg-green-900 text-green-300
```

**Amount colors:**
```
You paid    → text-green-400
You owe     → text-orange-400
Not involved → text-gray-500
USD badge   → bg-yellow-900 text-yellow-300 (small pill)
```

**Form layout:**
- Two-column layout on desktop: left column for main fields, right column for split details
- Single column on mobile
- Split details section: `bg-gray-800/50 rounded-lg p-4 border border-gray-700`
- Split preview box: `bg-indigo-950/50 rounded-lg p-4 border border-indigo-800`

**Expense list:**
- Month group heading: `text-xs font-semibold text-gray-400 uppercase tracking-widest`
  with a horizontal rule
- Expense row: `bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-gray-700`
  with smooth transition
- Expanded state: border color changes to `border-indigo-700`

---

## Behaviour Rules

1. **Recalculate splits server-side on every POST and PATCH.** Never trust the
   client's split calculations directly. The server must independently compute the
   splits and validate they are correct before saving.

2. **Equal split formula is always computed server-side.** The client sends
   `splitWith: [userId1, userId2, ...]` for equal splits, NOT `splitDetails`.
   The server calculates the amounts.

3. **Never allow a split with zero amount.** If any split results in ₹0 for a
   member (e.g., rounding edge case on very small amounts), return 400.

4. **Settlement expenses are excluded from the list by default.** The filter
   `isSettlement: false` must be the default in the GET query. Do not show
   settlement rows in the UI at all.

5. **The paidByUserId must be one of the members in splitWith.** If someone
   paid for something, they should be in the split. If they are not selected
   in splitWith, warn the user: "Paid by [Name] is not in the split. They will
   not be included as owing anything."
   Allow the user to proceed — there are legitimate cases (someone paid for
   others but owes nothing themselves).

6. **Decimal amounts in Prisma return as strings.** Prisma's `Decimal` type
   comes back as a string in JavaScript, not a number. Always convert:
   ```typescript
   const amount = parseFloat(expense.amountInr.toString())
   ```
   Failure to do this causes `NaN` in calculations.

7. **The edit form must handle existing splits correctly.** When loading an expense
   for editing, convert the `splitDetails` from the database shape back to the form
   shape. The `amountOwed`, `percentage`, and `splitRatio` fields are stored in
   `ExpenseSplit` — map them to the form's `splitDetails` array.

8. **Deleting an expense recalculates nothing.** The balance calculation always
   queries live from the database. There is no cached balance to invalidate.
   Deleting an expense automatically reflects in balances on next load.

9. **Date inputs use 'YYYY-MM-DD' format** for the HTML date input value attribute.
   Use `format(new Date(date), 'yyyy-MM-dd')` from date-fns to convert stored dates.

10. **Amount input must not allow negative values** in the form. The negative
    amount case only exists in imported CSV data (refunds), not in manually
    added expenses.

---

## File Checklist

```
✓  lib/splitCalculator.ts                                     ← Pure calculation logic
✓  types/expenses.ts                                          ← Shared TS types
✓  app/api/groups/[groupId]/expenses/route.ts                 ← GET list + POST create
✓  app/api/groups/[groupId]/expenses/[expenseId]/route.ts     ← GET + PATCH + DELETE
✓  app/(dashboard)/groups/[groupId]/expenses/page.tsx         ← Expense list page
✓  components/expenses/ExpenseList.tsx                        ← Month-grouped list
✓  components/expenses/ExpenseRow.tsx                         ← Single expense row
✓  components/expenses/ExpenseForm.tsx                        ← Full form all split types
✓  components/expenses/AddExpenseModal.tsx                    ← Create modal wrapper
✓  components/expenses/EditExpenseModal.tsx                   ← Edit modal wrapper
✓  components/expenses/DeleteExpenseDialog.tsx                ← Delete confirmation
```

---

## Testing Checklist

```
□  Add an equal split expense among 4 members → splits sum exactly to total amount
□  Add ₹1,000 equal split among 3 members → splits are 333.33, 333.33, 333.34
□  Add an unequal split → form blocks submit if amounts don't sum to total
□  Add a percentage split → form blocks submit if percentages don't sum to 100%
□  Add a percentage split where percentages sum to 110% → blocked by form
□  Add a share split → amounts are proportional to ratios
□  Add a USD expense of $100 → stored as $100, amountInr = ₹8,350, exchangeRate = 83.5
□  Add an expense dated March 1 → Meera appears in member selector (she was active)
□  Add an expense dated April 20 → Meera does NOT appear (she left March 31)
□  Add an expense dated April 20 → Sam appears (joined April 15)
□  Add an expense dated April 1 → Sam does NOT appear (joined April 15)
□  Edit an expense → splits are correctly pre-populated in the form
□  Delete an expense → it disappears from the list
□  Delete blocked for non-payer and non-creator → 403 returned
□  Expense list shows most recent first, grouped by month
□  Expense row shows "You owe ₹600" for correct member
□  Expense row shows "You paid ₹2,400" for the payer
□  Expense row expand shows all splits with correct amounts
□  Settlement expenses do NOT appear in the list
□  Filter by member → only shows expenses where that member has a split
□  Prisma Decimal values are converted to numbers before arithmetic (no NaN)
✓  pnpm tsc --noEmit passes with zero errors
□  No console errors in the browser on any of the above flows
```

---

## Common Mistakes to Avoid

- **Do not trust Prisma Decimal as a number.** `expense.amountInr` is a Prisma
  `Decimal` object, not a JS number. Call `.toString()` and then `parseFloat()`
  before doing any arithmetic. Silent `NaN` bugs will corrupt balances.

- **Do not recalculate splits on the client only.** The server must validate and
  recalculate. The client sends intent (percentages, ratios, userId list) and the
  server does the authoritative math.

- **Do not forget the date-based member filter.** Fetching all active members
  without checking the expense date is the most common correctness bug. Always
  filter `GroupMembership` by `joinedAt <= expenseDate AND (leftAt IS NULL OR leftAt >= expenseDate)`.

- **Do not use `createMany` for splits when you need the IDs back.** Use
  `create` in a loop inside the transaction, or use `createMany` and accept
  that you won't get the created IDs back (that is fine for this use case).

- **Do not allow the form to submit with zero members selected.** The zod schema
  enforces `splitWith.min(1)` but double-check the client-side disabled logic on
  the submit button also reflects this.

- **Do not format the date input value with slashes.** HTML date inputs require
  `YYYY-MM-DD` format. `new Date().toLocaleDateString()` gives the wrong format.
  Always use `format(date, 'yyyy-MM-dd')` from date-fns.

- **Do not show the isSettlement field in the expense form.** This flag is set
  only by the importer. Exposing it in the manual form would corrupt the data model.

- **Do not delete ExpenseSplit rows separately before deleting an Expense**
  unless your schema does not have cascade delete configured. Verify your
  schema — if there is no `onDelete: Cascade` on the splits relation, you must
  delete splits first, then the expense. Reversing the order will throw a
  foreign key constraint error.
