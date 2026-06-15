# Spreetail Expenses

A shared expense splitting web application for a group of flatmates. Built as part of the Spreetail engineering assignment.

## Live Demo

> Deployed on Vercel — [add your URL here]

Demo credentials:
| Name | Email | Password |
|---|---|---|
| Aisha | aisha@flat.com | password123 |
| Rohan | rohan@flat.com | password123 |
| Priya | priya@flat.com | password123 |
| Meera | meera@flat.com | password123 |
| Sam | sam@flat.com | password123 |
| Dev | dev@flat.com | password123 |

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js 14 (App Router) | Full-stack in one project, familiar stack |
| Language | TypeScript | Type safety catches split calculation bugs early |
| Database | PostgreSQL via Supabase | Relational DB as required, free tier, managed |
| ORM | Prisma 6 | Schema-first, type-safe queries, migration support |
| Auth | NextAuth.js v4 | Credentials provider, JWT sessions, minimal setup |
| Styling | Tailwind CSS | Utility-first, fast to iterate |
| CSV Parsing | PapaParse | Handles quoted fields, malformed rows, header mapping |
| Deployment | Vercel | Zero-config Next.js deployment |
| Package Manager | pnpm | Faster installs, strict module resolution |

---

## Local Setup

### Prerequisites

- Node.js 18 or above
- pnpm (`npm install -g pnpm`)
- A Supabase account (free tier is sufficient)

### Step 1 — Clone and install

```bash
git clone https://github.com/Suharshit/spreetail-expenses.git
cd spreetail-expenses
pnpm install
```

### Step 2 — Set up Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Go to **Project Settings → Database → Connection string**
3. Copy the **URI** (direct) and **Transaction pooler** strings

### Step 3 — Configure environment variables

Create a `.env` file in the project root:

```env
# Direct connection — used by Prisma for migrations
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.xxxx.supabase.co:5432/postgres"

# Pooler connection — used by the app at runtime
DIRECT_URL="postgresql://postgres:[PASSWORD]@db.xxxx.supabase.co:5432/postgres"

# Generate with: openssl rand -base64 32
NEXTAUTH_SECRET="your-generated-secret"

# Local dev
NEXTAUTH_URL="http://localhost:3000"
```

### Step 4 — Push schema and seed database

```bash
pnpm prisma db push
pnpm prisma db seed
```

This creates all tables and seeds 6 users (Aisha, Rohan, Priya, Meera, Sam, Dev) with the group "The Flat" and their membership date ranges pre-configured.

### Step 5 — Run the development server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). You will be redirected to the login page.

---

## How to Import the CSV

1. Log in as any seeded user (e.g., `aisha@flat.com / password123`)
2. Navigate to **The Flat** group
3. Click **Import CSV** in the group navigation
4. Upload `expenses_export.csv`
5. Click **Analyse File** — the app scans for all data problems
6. Review the anomaly table — approve or reject each flagged row
7. Click **Confirm and Import**
8. The import report is generated automatically showing every anomaly and the action taken

---

## Repository Structure

```
spreetail-expenses/
├── app/                  # Next.js App Router pages and API routes
│   ├── (auth)/           # Login and register pages
│   ├── (dashboard)/      # Protected pages behind auth
│   └── api/              # REST API routes
├── components/           # Reusable React components
├── lib/                  # Shared utilities (prisma client, auth config, importer)
│   └── importer/         # CSV import pipeline with anomaly detection
├── prisma/               # Schema and seed file
├── types/                # Shared TypeScript types
├── features/             # Module prompt files and context tracker
└── middleware.ts         # Route protection
```

---

## AI Tools Used

See [AI_USAGE.md](./AI_USAGE.md) for a full breakdown of how AI was used, key prompts, and three cases where the AI produced incorrect output that I caught and fixed.

---

## Key Design Decisions

See [DECISIONS.md](./DECISIONS.md) for every significant engineering and product decision, the alternatives considered, and the rationale for each choice.

---

## Data Anomaly Log

See [SCOPE.md](./SCOPE.md) for the full list of 22 data problems found in `expenses_export.csv`, the handling policy for each, and the complete database schema.