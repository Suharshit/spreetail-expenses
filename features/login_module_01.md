# Login Module — AI Build Prompt

## Your Role
You are a senior full-stack engineer working on a shared expenses web application
called **Spreetail Expenses**. Your task is to build the complete Login Module for
this project from scratch. Some files related to this module may already exist in
the codebase — read every existing file before writing anything. If something is
already written but broken, incomplete, or inconsistent with the rest of the stack,
fix it. Do not assume any file is correct just because it exists.

---

## Project Context

This is a shared expense splitting app (like Splitwise) for a group of flatmates.
It is being built as a full-stack web application. The login module is the entry
point — every other feature in the app sits behind authentication. If login is
broken, nothing else works.

The app has six users who are seeded into the database:
- Aisha (aisha@flat.com)
- Rohan (rohan@flat.com)
- Priya (priya@flat.com)
- Meera (meera@flat.com)
- Sam (sam@flat.com)
- Dev (dev@flat.com)

All seeded users have the password: `password123`

---

## Tech Stack (Do Not Change Any of These)

| Layer | Choice |
|---|---|
| Framework | Next.js 14 with App Router |
| Language | TypeScript (strict) |
| Database | PostgreSQL via Supabase |
| ORM | Prisma 6 |
| Authentication | NextAuth.js v4 (next-auth@4) |
| Password Hashing | bcryptjs |
| Styling | Tailwind CSS |
| Form Handling | react-hook-form |
| Validation | zod + @hookform/resolvers |
| Icons | lucide-react |
| Notifications | react-hot-toast |
| Package Manager | pnpm |

---

## Existing Project Structure

The project already has this base structure. Read these files before touching anything:

```
spreetail-expenses/
├── app/
│   └── api/
│       └── auth/
│           └── [...nextauth]/
│               └── route.ts        ← may already exist, verify it
├── lib/
│   ├── prisma.ts                   ← already exists, do not modify
│   └── auth.ts                     ← may already exist, verify it
├── prisma/
│   ├── schema.prisma               ← already exists, do not modify
│   └── seed.ts                     ← already exists, do not modify
├── .env                            ← already exists, do not modify
├── tailwind.config.ts              ← already exists
└── package.json                    ← already exists
```

---

## Prisma Schema Reference

The following models already exist in `prisma/schema.prisma`. 
Do not modify the schema. Use these field names exactly in your code:

```prisma
model User {
  id            String   @id @default(uuid(4))
  name          String
  email         String   @unique
  passwordHash  String
  createdAt     DateTime @default(now())
}
```

The Prisma client is already set up in `lib/prisma.ts` as a singleton. Import it like:
```typescript
import { prisma } from '@/lib/prisma'
```

---

## Environment Variables Already Set

These are already in the `.env` file. Use them exactly as named:

```
DATABASE_URL          ← Supabase PostgreSQL connection string
DIRECT_URL            ← Supabase direct connection string
NEXTAUTH_SECRET       ← Random base64 string for JWT signing
NEXTAUTH_URL          ← http://localhost:3000 in development
```

---

## What You Must Build

Build every file listed below. If a file already exists, read it fully before
deciding whether to keep, fix, or rewrite it.

---

### File 1: `lib/auth.ts`

NextAuth configuration. This file exports `authOptions` which is used by both
the NextAuth API route and `getServerSession()` in protected API routes.

**What it must do:**
- Use `CredentialsProvider` from `next-auth/providers/credentials`
- Accept `email` and `password` as credential fields
- In the `authorize` function:
  - Return `null` if email or password is missing
  - Query the database for a user with the given email using `prisma.user.findUnique`
  - Return `null` if no user is found (do NOT reveal whether email exists)
  - Compare the submitted password against `user.passwordHash` using `bcrypt.compare`
  - Return `null` if password does not match
  - Return `{ id: user.id, name: user.name, email: user.email }` on success
- Session strategy must be `'jwt'` (not database sessions)
- `jwt` callback: attach `user.id` to the token as `token.id` when user logs in
- `session` callback: attach `token.id` to `session.user.id`
- `pages.signIn` must point to `'/login'`

**What the exported session type must look like (user gets `id` field):**
```typescript
// session.user.id must be accessible as a string
// This requires augmenting the next-auth module types (see types/next-auth.d.ts)
```

---

### File 2: `types/next-auth.d.ts`

NextAuth does not include `id` on `session.user` by default. You must augment
the module types so TypeScript knows `session.user.id` exists.

**What it must do:**
```typescript
// Extend the Session interface so session.user.id is typed as string
// Extend the JWT interface so token.id is typed as string
// Without this file, every API route using session.user.id will show a TypeScript error
```

---

### File 3: `app/api/auth/[...nextauth]/route.ts`

The catch-all NextAuth API handler. 

**What it must do:**
- Import `NextAuth` from `next-auth`
- Import `authOptions` from `@/lib/auth`
- Create the handler: `const handler = NextAuth(authOptions)`
- Export it as both `GET` and `POST`

This file should be very short (5–6 lines). If it is longer, something is wrong.

---

### File 4: `app/api/auth/register/route.ts`

API route to create a new user account.

**What it must do:**
- Only accept `POST` requests
- Parse the request body: `{ name, email, password }`
- Validate all three fields are present and non-empty
- Validate email format (basic regex or zod)
- Validate password is at least 8 characters
- Check if a user with that email already exists using `prisma.user.findUnique`
- If email is taken, return `400` with `{ error: 'Email already in use' }`
- Hash the password using `bcrypt.hash(password, 10)`
- Create the user using `prisma.user.create` with `{ name, email, passwordHash: hash }`
- Return `201` with `{ id: user.id, name: user.name, email: user.email }`
- Never return the `passwordHash` in any response
- Wrap everything in try/catch, return `500` on unexpected errors

---

### File 5: `middleware.ts`

Protects all authenticated routes. Must be at the project root (same level as `package.json`).

**What it must do:**
- Use `withAuth` from `next-auth/middleware` OR export NextAuth's default middleware
- Protect all routes under `/dashboard` and `/groups`
- Allow `/login`, `/register`, and all `/api/auth/*` routes without authentication
- Redirect unauthenticated users to `/login`

**Matcher config:**
```typescript
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/groups/:path*',
  ]
}
```

---

### File 6: `app/(auth)/layout.tsx`

Layout wrapper for the auth pages (login + register).

**What it must do:**
- Be a simple centered layout
- Show the app name "Spreetail Expenses" as a heading above the form card
- No sidebar, no navbar — clean full-page centered card design
- Dark background with a white/light card in the center
- Must be a server component (no 'use client')

---

### File 7: `app/(auth)/login/page.tsx`

The login page. This is the first thing users see.

**What it must do:**
- Be a client component (`'use client'`)
- Render a form with two fields: Email and Password
- Use `react-hook-form` for form state management
- Use `zod` for validation schema:
  - email: must be valid email format
  - password: required, minimum 1 character (login, not registration)
- On submit:
  - Call `signIn('credentials', { email, password, redirect: false })`
  - If result has an error: show error message "Invalid email or password"
  - If success: call `router.push('/dashboard')`
- Show a loading spinner or disabled state on the button while submitting
- Show a link to `/register` at the bottom: "Don't have an account? Register"
- If the user is already logged in and visits `/login`, redirect them to `/dashboard`
  (use `useSession` to check — if session status is 'authenticated', redirect)

**Form fields:**
```
Email      → type="email", placeholder="you@example.com"
Password   → type="password", placeholder="••••••••"
Submit     → text "Sign In", full width button
```

**Error handling:**
- Field-level errors (from zod): shown below each input in red text
- Auth error (wrong password): shown as a red alert box above the form

---

### File 8: `app/(auth)/register/page.tsx`

The registration page for new users.

**What it must do:**
- Be a client component (`'use client'`)
- Render a form with four fields: Name, Email, Password, Confirm Password
- Use `react-hook-form` with `zod` schema:
  - name: required, minimum 2 characters
  - email: valid email format
  - password: minimum 8 characters
  - confirmPassword: must match password field (use `.refine()` in zod)
- On submit:
  - POST to `/api/auth/register` with `{ name, email, password }`
  - If response is 400 (email taken): show "This email is already registered"
  - If response is 201: automatically sign the user in using
    `signIn('credentials', { email, password, redirect: false })`
    then redirect to `/dashboard`
  - If any other error: show "Something went wrong. Please try again."
- Show loading state on button while request is in flight
- Show a link to `/login` at the bottom: "Already have an account? Sign in"

**Form fields:**
```
Name             → type="text", placeholder="Your name"
Email            → type="email", placeholder="you@example.com"
Password         → type="password", placeholder="Min 8 characters"
Confirm Password → type="password", placeholder="Repeat password"
Submit           → text "Create Account", full width button
```

---

### File 9: `components/ui/Input.tsx`

A reusable input component used by both login and register forms.

**What it must do:**
- Accept props: `label`, `error`, `id`, and all standard HTML input attributes via spread
- Show the label above the input
- Show error message below the input in red if `error` prop is provided
- Apply different border styling when `error` is present (red border)
- Must be forwardRef-compatible so react-hook-form's `register()` works with it

**Example usage:**
```typescript
<Input
  label="Email"
  id="email"
  type="email"
  error={errors.email?.message}
  {...register('email')}
/>
```

---

### File 10: `components/ui/Button.tsx`

A reusable button component used across the app.

**What it must do:**
- Accept props: `isLoading`, `variant` ('primary' | 'secondary' | 'danger'), 
  `size` ('sm' | 'md' | 'lg'), and all standard HTML button attributes
- When `isLoading` is true: show a spinner icon + disable the button
- Default variant: 'primary' (solid colored background)
- 'secondary': outline style
- 'danger': red background
- Full-width when `className="w-full"` is passed

---

### File 11: `app/(dashboard)/layout.tsx`

Layout wrapper for all authenticated pages. This is needed even if you are only
building login right now — Next.js App Router requires the layout to exist for the
redirect target (`/dashboard`) to render correctly.

**What it must do:**
- Be a server component
- Call `getServerSession(authOptions)` to get the current session
- If no session, redirect to `/login` using `redirect('/login')` from `next/navigation`
- If session exists, render a basic layout:
  - A left sidebar with: app name, nav links (Dashboard, Groups), user name + sign out button
  - A main content area with `{children}`
- The sign out button must call `signOut()` from next-auth — make a small client
  component `components/layout/SignOutButton.tsx` for this since the layout is a server component

---

### File 12: `app/(dashboard)/dashboard/page.tsx`

The page users land on after login. Keep this minimal — just a placeholder for now.

**What it must do:**
- Be a server component
- Get session with `getServerSession(authOptions)`
- Show: "Welcome back, [user name]" heading
- Show: "You're logged in. Navigate to Groups to get started." subtext
- This page will be expanded later by other modules

---

## Validation Rules Reference

Use these exact rules in your zod schemas:

```typescript
// Login schema
const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

// Register schema
const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})
```

---

## Design Requirements

Use Tailwind CSS only. No external component libraries. Follow these visual rules:

**Color palette:**
- Background (auth pages): `bg-gray-950`
- Card background: `bg-gray-900`
- Primary action color: `bg-indigo-600` hover `bg-indigo-700`
- Input background: `bg-gray-800`
- Input border: `border-gray-700` (error: `border-red-500`)
- Label text: `text-gray-300`
- Body text: `text-gray-400`
- Heading text: `text-white`
- Error text: `text-red-400`

**Layout:**
- Auth pages: full screen, flexbox centered, single card `max-w-md w-full`
- Card padding: `p-8`
- Card border radius: `rounded-xl`
- Card shadow: `shadow-2xl`
- Input height: `h-10` or `py-2.5`
- Button height: `h-10` for md size
- Spacing between form fields: `space-y-4`

**App name display:**
- Show "Spreetail Expenses" above the card
- Style: `text-2xl font-bold text-white` with an icon or simple text logo

---

## Behaviour Rules (Do Not Skip Any of These)

1. **Never expose passwordHash in any API response.** Ever. Omit it explicitly.
2. **Generic error messages for auth failures.** Say "Invalid email or password" for
   both wrong email AND wrong password. Never say "Email not found" — that reveals
   which emails are registered.
3. **Redirect already-logged-in users.** If someone visits `/login` while already
   authenticated, send them to `/dashboard` immediately.
4. **Protect routes at the middleware level.** Do not rely only on page-level session
   checks — the middleware must block unauthenticated access before any page renders.
5. **Loading states on all form submissions.** The submit button must be disabled and
   show a spinner while any async operation is in progress.
6. **Consistent error display.** Field errors appear below each input. Global errors
   (like "Invalid email or password") appear as an alert box above the form.
7. **Form does not reset on error.** If login fails, the email field should retain
   its value. Only the password field should be cleared.

---

## File Checklist (Verify Every One Before Finishing)

```
□  lib/auth.ts                              ← NextAuth config with jwt strategy
□  types/next-auth.d.ts                     ← session.user.id type extension
□  app/api/auth/[...nextauth]/route.ts      ← NextAuth handler GET + POST
□  app/api/auth/register/route.ts           ← User registration endpoint
□  middleware.ts                            ← Route protection
□  app/(auth)/layout.tsx                    ← Centered auth layout
□  app/(auth)/login/page.tsx                ← Login form page
□  app/(auth)/register/page.tsx             ← Register form page
□  components/ui/Input.tsx                  ← Reusable input with label + error
□  components/ui/Button.tsx                 ← Reusable button with loading state
□  app/(dashboard)/layout.tsx               ← Authenticated layout with sidebar
□  app/(dashboard)/dashboard/page.tsx       ← Post-login landing page
□  components/layout/SignOutButton.tsx      ← Client component for sign out
```

---

## Testing Checklist (Run These After Building)

After you finish building, verify every one of these works correctly:

```
□  Visit http://localhost:3000 → redirects to /login (middleware working)
□  Visit /dashboard without login → redirects to /login
□  Login with wrong password → shows "Invalid email or password", does NOT redirect
□  Login with correct credentials (aisha@flat.com / password123) → lands on /dashboard
□  /dashboard shows "Welcome back, Aisha"
□  Sign out button → clears session, redirects to /login
□  Visit /login while already logged in → redirects to /dashboard
□  Register with mismatched passwords → shows "Passwords do not match" error
□  Register with email already in use → shows "This email is already registered"
□  Register with new email → account created, auto-signed in, redirected to /dashboard
□  All form fields show red border + error message when zod validation fails
□  Submit buttons show loading state while request is in progress
□  TypeScript shows zero errors: run  pnpm tsc --noEmit
□  No console errors in browser DevTools on any of the above flows
```

---

## Common Mistakes to Avoid

- **Do not use `redirect: true` in `signIn()`** on the client side — it bypasses
  your error handling. Always use `redirect: false` and handle the result manually.
- **Do not call `getServerSession()` without passing `authOptions`** — it returns
  null without it, causing silent auth failures.
- **Do not put `'use client'` on layout files** — layouts that fetch sessions must
  be server components. Extract interactive parts (sign out button) into separate
  client components.
- **Do not forget to export `config` from middleware.ts** — without the matcher,
  the middleware runs on every single request including static files and will break.
- **Do not use `session.user.id` without the type augmentation** — TypeScript will
  error because the default next-auth types do not include `id` on session user.
- **Do not store sessions in the database** — this project uses `strategy: 'jwt'`.
  Using the database session strategy requires additional NextAuth adapter setup
  and will break the existing schema.

---

## How to Run After Building

```bash
# Start the development server
pnpm dev

# Type check (must pass with zero errors)
pnpm tsc --noEmit

# If you made any schema changes (you should not need to)
pnpm prisma db push
pnpm prisma generate
```

---

## What This Module Does NOT Include

Do not build these — they belong to other modules:

- Groups pages or API routes
- Expense pages or API routes
- Balance calculation
- CSV import
- Any page other than `/login`, `/register`, and `/dashboard` (placeholder only)

Your responsibility ends at: user can log in, register, and land on a dashboard page
that shows their name. Everything else is out of scope for this module.