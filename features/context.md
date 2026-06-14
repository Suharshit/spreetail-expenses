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
- [ ] `app/api/groups/route.ts` - GET list + POST create
- [ ] `app/api/groups/[groupId]/route.ts` - GET single + PATCH + DELETE
- [ ] `app/api/groups/[groupId]/members/route.ts` - GET + POST add + PATCH remove
- [ ] `app/api/users/route.ts` - GET all users (for dropdown)
- [ ] `app/(dashboard)/groups/page.tsx` - Groups list page
- [ ] `app/(dashboard)/groups/[groupId]/page.tsx` - Group detail page
- [ ] `components/groups/GroupCard.tsx` - Group card component
- [ ] `components/groups/MembersTable.tsx` - Reusable members table
- [ ] `components/groups/GroupForm.tsx` - Create/edit group form
- [ ] `components/groups/AddMemberModal.tsx` - Add member modal
- [ ] `components/groups/RemoveMemberModal.tsx` - Remove member modal

### Outstanding Tasks / Next Steps
- Verify application flows on runtime (Login, Registration, Redirects).
- Wait for upcoming modules (e.g., Groups, Expenses) to populate the main dashboard content.
