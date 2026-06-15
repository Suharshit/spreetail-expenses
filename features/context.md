# Project Context & Progress Tracker

## Project Context
Spreetail Expenses is a full-stack shared expense splitting web application (similar to Splitwise) designed for a group of flatmates. The users are pre-seeded into the PostgreSQL database. Every feature in the app sits behind authentication. The app is built with Next.js 14 (App Router), TypeScript, PostgreSQL (via Supabase), Prisma 6, NextAuth.js v4 (credentials provider with JWT strategy), and Tailwind CSS for styling.

## Progress Tracker

### Login Module (`features/login_module_01.md`)
- [x] `lib/auth.ts` - Configured NextAuth with credentials, JWT strategy, encrypts/compares passwords with bcryptjs.
- [x] `types/next-auth.d.ts` - NextAuth type augmentations for session.user.id.
- [x] `app/api/auth/[...nextauth]/route.ts` - NextAuth catch-all handler.
- [x] `app/api/auth/register/route.ts` - Registration API endpoint with hash, 400 unique checks, returning 201.
- [x] `middleware.ts` - Protected routes at the root middleware.
- [x] `app/(auth)/layout.tsx` - Centered layout for auth forms.
- [x] `app/(auth)/login/page.tsx` - Login page built using `zod` and `react-hook-form` displaying inline and global errors.
- [x] `app/(auth)/register/page.tsx` - Registration page matching zod schemas, calls signup, signs user in upon creation.
- [x] `components/ui/Input.tsx` - Reusable Input component.
- [x] `components/ui/Button.tsx` - Reusable Button component (supports isLoading prop and variants).
- [x] `app/(dashboard)/layout.tsx` - Layout with Sidebar, loads server session, handles sign-out UI via SignOutButton.
- [x] `app/(dashboard)/dashboard/page.tsx` - Dashboard landing page displaying welcome message.
- [x] `components/layout/SignOutButton.tsx` - Interactive client component that calls `signOut` to NextAuth.

### Groups Module (`features/groups_module_02.md`)
- [x] `app/api/groups/route.ts` - GET list + POST create
- [x] `app/api/groups/[groupId]/route.ts` - GET single + PATCH + DELETE
- [x] `app/api/groups/[groupId]/members/route.ts` - GET + POST add + PATCH remove
- [x] `app/api/users/route.ts` - GET all users (for dropdown)
- [x] `app/(dashboard)/groups/page.tsx` - Groups list page
- [x] `app/(dashboard)/groups/[groupId]/page.tsx` - Group detail page
- [x] `components/groups/GroupCard.tsx` - Group card component
- [x] `components/groups/MembersTable.tsx` - Reusable members table
- [x] `components/groups/GroupForm.tsx` - Create/edit group form
- [x] `components/groups/AddMemberModal.tsx` - Add member modal
- [x] `components/groups/RemoveMemberModal.tsx` - Remove member modal

### Expenses Module (`features/expenses_module_03.md`)
- [x] `lib/splitCalculator.ts` - Shared split calculation utilities with consistent rounding.
- [x] `types/expenses.ts` - Shared expense module types, schema, and USD conversion constant.
- [x] `app/api/groups/[groupId]/expenses/route.ts` - Expense listing filters and creation flow.
- [x] `app/api/groups/[groupId]/expenses/[expenseId]/route.ts` - Single expense read, update, and delete flow.
- [x] `app/(dashboard)/groups/[groupId]/expenses/page.tsx` - Server-rendered expenses page.
- [x] `components/expenses/ExpensesPageClient.tsx` - Filters, refresh handling, and modal orchestration.
- [x] `components/expenses/ExpenseList.tsx` - Month-grouped expense rendering with subtotals.
- [x] `components/expenses/ExpenseRow.tsx` - Expandable expense rows with split breakdowns.
- [x] `components/expenses/ExpenseForm.tsx` - Create/edit form with date-aware member filtering and live previews.
- [x] `components/expenses/AddExpenseModal.tsx` - Create flow wrapper.
- [x] `components/expenses/EditExpenseModal.tsx` - Edit flow wrapper.
- [x] `components/expenses/DeleteExpenseDialog.tsx` - Delete confirmation flow.
- [x] `DECISIONS.md` - Fixed USD to INR conversion rule documented.

### Outstanding Tasks / Next Steps
- Verify runtime flows in the browser for expenses create/edit/delete and filter states.
- Build the remaining group sub-pages: balances, settlements, and CSV import.
