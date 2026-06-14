# Groups Module — AI Build Prompt

## Your Role
You are a senior full-stack engineer. Your task is to build the complete Groups
Module for this project. Some files related to this module may already exist —
read every existing file before writing anything. If something is already written
but broken, incomplete, or inconsistent with the stack, fix it. Do not assume
any file is correct just because it exists.

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
model User {
  id            String   @id @default(uuid(4))
  name          String
  email         String   @unique
  passwordHash  String
  createdAt     DateTime @default(now())

  groupsCreated       Group[]           @relation("GroupCreator")
  memberships         GroupMembership[]
}

model Group {
  id          String   @id @default(uuid(4))
  name        String
  description String?
  createdBy   String
  createdAt   DateTime @default(now())

  creator     User              @relation("GroupCreator", fields: [createdBy], references: [id])
  memberships GroupMembership[]
  expenses    Expense[]
  settlements Settlement[]
  importSessions ImportSession[]
}

model GroupMembership {
  id       String    @id @default(uuid(4))
  groupId  String
  userId   String
  joinedAt DateTime
  leftAt   DateTime?

  group Group @relation(fields: [groupId], references: [id])
  user  User  @relation(fields: [userId], references: [id])

  @@unique([groupId, userId])
}
```

Import the Prisma client exactly like this:
```typescript
import { prisma } from '@/lib/prisma'
```

Get the current session in API routes exactly like this:
```typescript
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const session = await getServerSession(authOptions)
if (!session?.user?.id) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

---

## Critical Business Logic — Read This Before Writing Any Code

### Time-Based Membership

This is the most important concept in the entire module. Membership is not a
simple boolean. Each member has a `joinedAt` date and an optional `leftAt` date.

Real scenario this handles:
- Meera was in the group from February. She moved out end of March (`leftAt: 2026-03-31`)
- Sam joined mid-April (`joinedAt: 2026-04-15`)
- An expense dated April 2nd should NOT include either Meera or Sam

This means:

**When showing members for a group:**
- Show ALL memberships (past and present) with their date range
- Active members: `leftAt IS NULL`
- Past members: `leftAt IS NOT NULL`
- Never delete a membership row — only set `leftAt`

**When filtering who can be added to an expense:**
- Only members who were active on the expense's date
- SQL: `joinedAt <= expenseDate AND (leftAt IS NULL OR leftAt >= expenseDate)`

**When removing a member:**
- Do NOT run `prisma.groupMembership.delete()`
- Run `prisma.groupMembership.update({ data: { leftAt: providedDate } })`
- The membership record must remain so historical expenses still reference that person

**When adding a member:**
- Check if a membership row already exists for this user in this group
- If it exists and `leftAt` is set: this is a rejoin — update `leftAt` to null and
  update `joinedAt` to the new date (person moved back in)
- If it exists and `leftAt` is null: they are already active, return an error
- If no row exists: create a new GroupMembership row

---

## What You Must Build

---

### File 1: `app/api/groups/route.ts`

Handles listing all groups and creating a new group.

**GET /api/groups**

What it must do:
- Get current session, return 401 if not authenticated
- Find all groups where the current user has a GroupMembership record
  (regardless of whether they have left — they can still view groups they were in)
- For each group, include:
  - All memberships with user name and email
  - Count of expenses (do not fetch all expenses, just `_count`)
- Return the array of groups

```typescript
// Query pattern:
const groups = await prisma.group.findMany({
  where: {
    memberships: {
      some: {
        userId: session.user.id
      }
    }
  },
  include: {
    memberships: {
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { joinedAt: 'asc' }
    },
    _count: {
      select: { expenses: true }
    }
  },
  orderBy: { createdAt: 'desc' }
})
```

**POST /api/groups**

Body: `{ name: string, description?: string }`

What it must do:
- Validate `name` is present and non-empty (return 400 if missing)
- Create the group with `createdBy: session.user.id`
- Immediately create a GroupMembership for the creator:
  `{ groupId: group.id, userId: session.user.id, joinedAt: new Date() }`
- Do both operations in a Prisma transaction so neither can succeed without the other
- Return 201 with the created group including memberships

```typescript
// Transaction pattern:
const result = await prisma.$transaction(async (tx) => {
  const group = await tx.group.create({ ... })
  await tx.groupMembership.create({ ... })
  return group
})
```

---

### File 2: `app/api/groups/[groupId]/route.ts`

Handles fetching and updating a single group.

**GET /api/groups/[groupId]**

What it must do:
- Verify current user has a membership in this group (return 403 if not)
- Return the group with:
  - All memberships ordered by `joinedAt` ascending, with user details
  - `_count` of expenses and settlements
- Return 404 if group does not exist

**PATCH /api/groups/[groupId]**

Body: `{ name?: string, description?: string }`

What it must do:
- Verify current user is the group creator (`group.createdBy === session.user.id`)
- Return 403 if not the creator
- Update only the fields that are provided in the body (partial update)
- Return updated group

**DELETE /api/groups/[groupId]**

What it must do:
- Verify current user is the group creator
- Check if the group has any expenses
- If expenses exist: return 400 with message
  "Cannot delete group with existing expenses. Remove all expenses first."
- If no expenses: delete all memberships first, then delete the group
- Return 200 on success

---

### File 3: `app/api/groups/[groupId]/members/route.ts`

Handles reading members and adding/removing them.

**GET /api/groups/[groupId]/members**

What it must do:
- Verify current user is a member of this group
- Return all memberships ordered by `joinedAt` ascending
- Include user details: `{ id, name, email }`
- Separate into two arrays in the response:
  ```typescript
  {
    activeMembers: GroupMembership[],   // leftAt IS NULL
    pastMembers: GroupMembership[]      // leftAt IS NOT NULL
  }
  ```

**POST /api/groups/[groupId]/members**

Body: `{ userId: string, joinedAt: string (ISO date) }`

What it must do:
- Verify current user is a member of this group
- Validate `userId` and `joinedAt` are present
- Validate the user exists in the database
- Check for existing membership:
  - If active membership exists (leftAt IS NULL): return 400 "User is already a member"
  - If past membership exists (leftAt IS NOT NULL): update it — set `leftAt: null`,
    update `joinedAt` to the new date (rejoin scenario)
  - If no membership: create new GroupMembership
- Return 201 with the membership including user details

**PATCH /api/groups/[groupId]/members**

Body: `{ userId: string, leftAt: string (ISO date) }`

This is the "remove member" endpoint. It never actually deletes.

What it must do:
- Verify current user is a member of this group
- Validate `userId` and `leftAt` are present
- Find the active membership for this user in this group
- Return 404 if no active membership found
- Validate `leftAt` is not before `joinedAt` (return 400 if it is)
- Update `leftAt` on the membership
- Return 200 with updated membership

---

### File 4: `app/(dashboard)/groups/page.tsx`

The groups list page. Shows all groups the logged-in user belongs to.

What it must do:
- Be a server component
- Get session, redirect to `/login` if not authenticated
- Fetch groups from `/api/groups` (or query directly with prisma — server component
  can do this without an API call)
- If no groups: show an empty state with a "Create your first group" call to action
- If groups exist: show a grid of group cards
- Show a "New Group" button in the top right that opens a modal form

**Group card must show:**
- Group name (large, bold)
- Description (if present, muted text)
- Active member count: e.g., "4 members"
- Total expense count: e.g., "23 expenses"
- Member avatar row: show initials of up to 4 active members, "+N more" if more
- "View Group" button that links to `/groups/[groupId]`

**New Group Modal:**
- Triggered by the "New Group" button
- Fields: Name (required), Description (optional)
- On submit: POST to `/api/groups`
- On success: refresh the page or add the new group to state
- On error: show the error message in the modal

---

### File 5: `app/(dashboard)/groups/[groupId]/page.tsx`

The group detail page. This is the main hub for a group.

What it must do:
- Be a server component
- Get session, redirect if not authenticated
- Fetch the group by ID (or 404 if not found / user is not a member)
- Show four clearly separated sections:

**Section 1 — Group Header**
- Group name as page heading
- Description (if present)
- Created date: "Created February 1, 2026"
- Edit button (only visible to group creator) — opens edit modal
- Delete button (only visible to group creator)

**Section 2 — Active Members**
- Table with columns: Avatar | Name | Email | Joined | Actions
- "Joined" shows formatted date e.g. "Feb 1, 2026"
- Actions column: "Remove" button (only show to group creator)
- "Add Member" button above the table → opens add member modal

**Section 3 — Past Members**
- Collapsible section (collapsed by default)
- Table with columns: Avatar | Name | Email | Joined | Left
- No action buttons — past members are read-only
- If no past members: do not show this section at all

**Section 4 — Quick Links**
- Four cards linking to sub-pages:
  - "Expenses" → `/groups/[groupId]/expenses`
  - "Balances" → `/groups/[groupId]/balances`
  - "Settlements" → `/groups/[groupId]/settlements`
  - "Import CSV" → `/groups/[groupId]/import`
- Each card shows an icon, title, and one-line description

**Add Member Modal:**
- Triggered by "Add Member" button
- Fields:
  - User selector: dropdown of all users NOT currently active in this group
    (fetch all users, exclude those with active memberships)
  - Joined Date: date picker, defaults to today
- On submit: POST to `/api/groups/[groupId]/members`
- On success: refresh page or add member to state

**Remove Member Modal:**
- Triggered by "Remove" button next to a member
- Shows: "Are you sure you want to remove [Name] from the group?"
- Fields:
  - Left Date: date picker, defaults to today
- On submit: PATCH to `/api/groups/[groupId]/members`
- On success: refresh page or update member status
- Warning message in modal:
  "This will not delete their past expenses. [Name] will be excluded from
  new expenses after the left date."

---

### File 6: `components/groups/GroupCard.tsx`

Reusable card component for displaying a group in the list.

Props:
```typescript
type GroupCardProps = {
  group: {
    id: string
    name: string
    description: string | null
    createdAt: Date
    memberships: Array<{
      user: { id: string; name: string }
      leftAt: Date | null
    }>
    _count: { expenses: number }
  }
}
```

What it must render:
- Group name
- Description (truncated at 2 lines with `line-clamp-2` if long)
- Active member count (filter memberships where leftAt IS NULL)
- Expense count
- Avatar row: first letter of each active member's name in colored circles
  (use consistent colors per name using a hash or index)
- "View Group →" link button

---

### File 7: `components/groups/MembersTable.tsx`

Reusable table for showing members.

Props:
```typescript
type MembersTableProps = {
  memberships: Array<{
    id: string
    joinedAt: Date
    leftAt: Date | null
    user: { id: string; name: string; email: string }
  }>
  showActions: boolean        // false for past members table
  onRemove?: (userId: string, userName: string) => void
}
```

What it must render:
- A clean table with alternating row backgrounds
- Avatar column: first letter of name in a colored circle
- Name + Email in same cell (name bold, email muted below)
- Joined date formatted as "Feb 1, 2026"
- Left date formatted the same (only in past members table)
- Remove button if `showActions` is true and `onRemove` is provided

---

### File 8: `components/groups/GroupForm.tsx`

Reusable form used in both the Create and Edit group modals.

Props:
```typescript
type GroupFormProps = {
  defaultValues?: { name: string; description: string }
  onSubmit: (data: { name: string; description: string }) => Promise<void>
  onCancel: () => void
  submitLabel: string       // "Create Group" or "Save Changes"
  isLoading: boolean
}
```

What it must render:
- Name input (required)
- Description textarea (optional, 3 rows)
- Cancel and Submit buttons in a row at the bottom
- Inline validation errors using zod schema:
  ```typescript
  const groupSchema = z.object({
    name: z.string().min(1, 'Group name is required').max(100),
    description: z.string().max(500).optional(),
  })
  ```

---

### File 9: `components/groups/AddMemberModal.tsx`

Modal for adding a member to the group.

Props:
```typescript
type AddMemberModalProps = {
  isOpen: boolean
  onClose: () => void
  groupId: string
  existingMemberIds: string[]    // to exclude from the user dropdown
  onSuccess: () => void          // called after successful add to trigger refresh
}
```

What it must do:
- Fetch all users from `/api/users` on mount (you need to create this simple route)
- Filter out users already in `existingMemberIds`
- Show a select dropdown of available users
- Show a date picker for `joinedAt` (default: today)
- POST to `/api/groups/[groupId]/members` on submit
- Show error if returned (e.g., "User is already a member")
- Call `onSuccess()` and `onClose()` on successful add

---

### File 10: `components/groups/RemoveMemberModal.tsx`

Confirmation modal for removing a member.

Props:
```typescript
type RemoveMemberModalProps = {
  isOpen: boolean
  onClose: () => void
  groupId: string
  member: { userId: string; name: string; joinedAt: Date } | null
  onSuccess: () => void
}
```

What it must do:
- Show member name in heading: "Remove [Name] from group?"
- Show warning about past expenses being kept
- Show a date picker for `leftAt` (default: today)
- Validate `leftAt` is not before member's `joinedAt` on the client side
- PATCH to `/api/groups/[groupId]/members` on confirm
- Call `onSuccess()` and `onClose()` on success

---

### File 11: `app/api/users/route.ts`

A simple API route needed by AddMemberModal to populate the user dropdown.

**GET /api/users**

What it must do:
- Verify user is authenticated
- Return all users with only: `{ id, name, email }`
- Never return `passwordHash`
- Order by name ascending

```typescript
const users = await prisma.user.findMany({
  select: { id: true, name: true, email: true },
  orderBy: { name: 'asc' }
})
```

---

## Design Requirements

Use the same dark theme as the login module. All colors must be consistent.

**Color palette (same as login module):**
- Page background: `bg-gray-950`
- Card / table background: `bg-gray-900`
- Border color: `border-gray-800`
- Primary action: `bg-indigo-600` hover `bg-indigo-700`
- Destructive action: `bg-red-600` hover `bg-red-700`
- Secondary button: `border border-gray-700 text-gray-300` hover `bg-gray-800`
- Active member badge: `bg-green-900 text-green-300`
- Past member badge: `bg-gray-800 text-gray-400`
- Table header: `bg-gray-800 text-gray-400 text-xs uppercase tracking-wider`
- Table row hover: `hover:bg-gray-800/50`

**Avatar circles:**
Use a consistent color mapping per member name initial. Suggested palette:
```typescript
const AVATAR_COLORS = [
  'bg-purple-600', 'bg-blue-600', 'bg-green-600',
  'bg-yellow-600', 'bg-red-600', 'bg-pink-600',
]
// Assign by: AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]
```

**Modal design:**
- Overlay: `fixed inset-0 bg-black/60 backdrop-blur-sm`
- Modal box: `bg-gray-900 rounded-xl shadow-2xl max-w-md w-full p-6`
- Title: `text-lg font-semibold text-white`
- Close button: `X` icon top-right corner

**Responsive:**
- Group cards grid: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`
- Tables: horizontally scrollable on mobile with `overflow-x-auto`

---

## Behaviour Rules

1. **Never delete a membership row.** Only set `leftAt`. If you call
   `prisma.groupMembership.delete()` anywhere, that is a bug.

2. **Never show past members in the active members list.** Filter strictly by
   `leftAt === null` for active members.

3. **Group creator vs member permissions.** Only the group creator (`group.createdBy`)
   can edit the group name, add members, remove members, and delete the group.
   Other members can view everything but cannot modify.

4. **Membership uniqueness constraint.** The schema has `@@unique([groupId, userId])`.
   This means a user can only have ONE membership row per group. Handle the rejoin
   case by updating the existing row, not creating a second one.

5. **Empty state handling.** Every list — groups, members, past members — must have
   a proper empty state with a helpful message and a call to action button where
   applicable.

6. **Loading states.** All buttons that trigger async operations must show a spinner
   and be disabled while the operation is in progress.

7. **Optimistic UI is not required.** A page refresh or router refresh after a
   successful mutation is acceptable. Use `router.refresh()` from `next/navigation`.

8. **Date display consistency.** Use `date-fns` for all date formatting.
   Format: `format(new Date(date), 'MMM d, yyyy')` → "Feb 1, 2026"

9. **Authorization check in every API route.** Every single API route in this module
   must verify: (a) the user is authenticated, and (b) the user has a membership
   in the group being accessed. Return 401 or 403 appropriately.

10. **Seeded group.** The seed script already created a group called "The Flat" with
    the ID `'flat-group-id-001'`. Your GET /api/groups endpoint must return this group
    for any of the seeded users who are members.

---

## File Checklist

```
□  app/api/groups/route.ts                          ← GET list + POST create
□  app/api/groups/[groupId]/route.ts                ← GET single + PATCH + DELETE
□  app/api/groups/[groupId]/members/route.ts        ← GET + POST add + PATCH remove
□  app/api/users/route.ts                           ← GET all users (for dropdown)
□  app/(dashboard)/groups/page.tsx                  ← Groups list page
□  app/(dashboard)/groups/[groupId]/page.tsx        ← Group detail page
□  components/groups/GroupCard.tsx                  ← Group card component
□  components/groups/MembersTable.tsx               ← Reusable members table
□  components/groups/GroupForm.tsx                  ← Create/edit group form
□  components/groups/AddMemberModal.tsx             ← Add member modal
□  components/groups/RemoveMemberModal.tsx          ← Remove member modal
```

---

## Testing Checklist

```
□  Seeded users (aisha@flat.com / password123) can log in and see "The Flat" group
□  Clicking "The Flat" shows the group detail page with 4 active members and 2 past
   (Meera left March 31, Dev left March 14)
□  Past members section is collapsed by default and shows Meera and Dev when expanded
□  "Add Member" button is visible only to the group creator (Aisha)
□  "Remove" button is visible only to the group creator (Aisha)
□  Adding a member who is already active returns "User is already a member" error
□  Removing a member sets their leftAt and moves them to past members section
□  Removing Meera (who already has leftAt set) is not possible — she has no active membership
□  Setting leftAt before joinedAt shows a client-side validation error
□  Creating a new group via the modal shows it in the groups list immediately
□  Creating a group automatically makes the creator a member of that group
□  Deleting a group with no expenses succeeds
□  Deleting "The Flat" (which has expenses) returns an error
□  Non-creator users see the group but have no edit/add/remove buttons
□  Direct URL access to a group the user is not a member of returns 403
□  pnpm tsc --noEmit runs with zero TypeScript errors
□  No console errors in the browser on any of the above flows
```

---

## Common Mistakes to Avoid

- **Do not delete membership rows.** Even the DELETE method on the members endpoint
  must only set `leftAt`, not call `prisma.groupMembership.delete()`.

- **Do not use `new Date()` for the `joinedAt` default in AddMemberModal** without
  formatting it to `YYYY-MM-DD` first. HTML date inputs require this format.
  Use: `format(new Date(), 'yyyy-MM-dd')` from date-fns.

- **Do not query all expenses into memory to count them.** Use Prisma's `_count`
  in the `include` clause. Fetching thousands of expense objects just to get a count
  is a performance bug.

- **Do not forget the `@@unique([groupId, userId])` constraint.** If you try to
  `prisma.groupMembership.create()` for a user who already has a row (even with
  `leftAt` set), the database will throw a unique constraint error. Always check
  first and upsert or update as needed.

- **Do not make the group detail page a client component.** It should be a server
  component that fetches data. Extract only the interactive parts (modals, buttons)
  into smaller client components.

- **Do not expose `passwordHash` in `/api/users`.** Always use `select` to
  explicitly pick only `{ id, name, email }`.

- **Do not forget to check group membership in API routes.** Just because a user is
  authenticated does not mean they can access any group. Always verify they have a
  GroupMembership record for the requested `groupId`.