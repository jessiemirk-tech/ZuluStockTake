# Zulu Zenith Stock Take & Exchange — Multi-Tenant Next.js/Supabase/Vercel

## What this is

A production-grade rebuild of the single-page prototype: Next.js 15 (App
Router, TypeScript), Supabase (Postgres + Auth + RLS), deployed on Vercel.
Three roles — `staff`, `office`, `super_admin` — across multiple tenants
(stores), enforced by **three independent layers**, any one of which is
sufficient on its own to stop an unauthorized action:

1. **RLS policies** (`supabase/migrations/0001_init.sql`) — the database
   itself refuses cross-tenant reads/writes, regardless of what the app
   layer does or doesn't check.
2. **`middleware.ts`** — redirects staff away from `/dashboard/office/*`
   before the page even renders. This is a UX layer, not a security
   boundary (see note below).
3. **Route Handlers** (`app/api/export/*`) — independently re-check
   `role` server-side before touching any data, so the Excel exports
   cannot be reached by a staff session no matter what the client does.

Layer 2 (middleware) is explicitly a *convenience* layer — it makes staff
land somewhere sensible instead of a raw 403. The actual security
guarantees come from layers 1 and 3, which run entirely server-side and
can't be affected by anything in the browser.

## Repo structure (ready to push to GitHub → import in Vercel)

```
zuluzenith-app/
├── .env.example
├── .gitignore
├── README.md
├── next.config.mjs
├── postcss.config.mjs
├── tailwind.config.ts
├── tsconfig.json
├── package.json
├── middleware.ts                              route gating (office vs counter)
├── supabase/
│   └── migrations/
│       └── 0001_init.sql                      schema + RLS + helper fns
├── types/
│   └── database.ts                            hand-written DB types (see note)
├── lib/
│   └── supabase/
│       ├── server.ts                          RLS-scoped + service-role clients
│       ├── client.ts                          browser client
│       └── middleware.ts                      session-refresh helper
├── components/
│   ├── count-keypad.tsx                       tap ±1 / long-press bulk keypad
│   └── export-button.tsx                      calls the protected export routes
└── app/
    ├── layout.tsx                             Space Grotesk / Inter fonts
    ├── globals.css
    ├── page.tsx                                / → redirects by role
    ├── login/
    │   ├── page.tsx
    │   └── login-form.tsx                      Supabase Auth sign-in
    ├── account-disabled/
    │   └── page.tsx
    ├── actions/
    │   ├── stock-counts.ts                     upsertStockCount, startStockTakeSession
    │   ├── exchange-logs.ts                    createExchangeLog
    │   └── staff.ts                            setStaffActive (deactivate/reactivate)
    ├── api/
    │   ├── admin/
    │   │   └── create-staff/route.ts           office-only: creates staff/office logins
    │   └── export/
    │       ├── stock-take/route.ts             office-only .xlsx export
    │       └── exchange-log/route.ts           office-only .xlsx export
    └── dashboard/
        ├── counter/
        │   ├── page.tsx                        staff home hub
        │   ├── count/page.tsx                  stock-take counting grid
        │   └── exchange/
        │       ├── page.tsx                    staff's own recent entries
        │       └── exchange-form.tsx
        └── office/
            ├── page.tsx                        office dashboard + exports
            ├── exchange-history/page.tsx        full tenant log (office-only)
            └── staff/
                ├── page.tsx                     staff roster + add form
                ├── add-staff-form.tsx            calls /api/admin/create-staff
                └── staff-row-actions.tsx         deactivate/reactivate toggle
```

Every `.ts`/`.tsx` file here passed `tsc --noEmit` with zero errors (validated
against stub type declarations for external packages, since this sandbox has
no network access to `npm install` — see note below). Every `@/*` and
relative import was also checked to resolve to a real file, so there are no
broken imports waiting to surprise you on the first Vercel build.

## What's included

Every file/route above is present and wired together end-to-end: sign in at
`/login` → land on `/dashboard/counter` (staff) or `/dashboard/office`
(office/super_admin) → count stock, log exchanges, and — office only —
download both Excel exports or manage the team at
`/dashboard/office/staff`. `middleware.ts` gates the routes, RLS gates the
data, and the export/admin Route Handlers independently re-check role
before doing anything.

**Adding a new user** now works entirely in-app: Office → Manage Staff →
fill in name/email/password/role → Create Account. That form posts to
`app/api/admin/create-staff/route.ts`, the only place in the codebase that
touches the Supabase service role. It re-verifies the caller is
`office`/`super_admin` itself (never trusts the client), pins an `office`
caller to their own `tenant_id` and blocks them from ever assigning
`super_admin`, then calls `supabase.auth.admin.createUser()` with metadata
that the existing `handle_new_user()` trigger turns into a correctly-scoped
`profiles` row automatically — no manual SQL required for routine hires.
Deactivating someone reuses the RLS policy already in the migration rather
than the service role, since ordinary tenant-scoped UPDATE permissions are
already sufficient for that.

## What's deliberately NOT included (next steps for you)

- **Catalog seeding** — `products`/`skus` tables are empty until you seed
  them. Write a one-off script that loads your 37 styles / 889 SKUs into
  `products`/`skus` via the service role client.
- **`super_admin` tenant-management UI** — not built; same patterns as the
  office dashboard pages above. The create-staff route already supports a
  `super_admin` caller specifying any `tenantId`/`role`, so the UI is the
  remaining piece.
- **Password reset flow** — there's no "forgot password" page yet; today,
  an Office user would need to deactivate + recreate an account, or you can
  wire up `supabase.auth.resetPasswordForEmail()` on the login page.
- **shadcn/ui primitives** — `tailwind.config.ts` is wired up, but run
  `npx shadcn@latest init` yourself if you want the actual component
  library referenced in your brief; the pages here use plain Tailwind
  classes so they don't block on that install.

## Setup

1. **Supabase project**: create one, then run
   `supabase/migrations/0001_init.sql` in the SQL editor (or
   `supabase db push` if using the CLI).
2. **First tenant + super_admin**: manually insert one row into `tenants`,
   create one `auth.users` row (Supabase dashboard → Authentication →
   Add User), then update its `profiles` row to
   `role = 'super_admin', tenant_id = null`. Every subsequent account
   should go through your admin-provisioning endpoint instead of manual
   SQL.
3. **Env vars**: copy `.env.example` to `.env.local`, fill in your
   project's URL/anon key/service role key. Set the same three in Vercel's
   Environment Variables (service role key: **production/preview only**,
   never exposed to `NEXT_PUBLIC_*`).
4. **Install & typecheck**: `npm install && npx tsc --noEmit`.
5. **Deploy**: connect the repo to Vercel; it auto-detects Next.js.
   Add the Supabase env vars in the Vercel dashboard before the first
   deploy — the build will fail on missing `NEXT_PUBLIC_SUPABASE_URL`
   otherwise.

## Design notes worth knowing before you extend this

- **`stock_counts` is tenant-scoped for both roles**, not staff-restricted
  to their own rows. Counting is inherently collaborative (staffer A does
  Front, staffer B does Back-of-House on the same SKU) — restricting reads
  to "your own rows only" would break that. The office-only boundary is
  specifically the *bulk export*, not row visibility. `exchange_logs` is
  different: staff can only `SELECT` their own submitted rows (per your
  brief, staff shouldn't browse historical logs), while office sees
  everything for the tenant.
- **`security definer` helper functions** (`current_tenant_id()`,
  `current_role()`) exist because a policy on `stock_counts` that directly
  subqueries `profiles` would itself be subject to `profiles`' RLS,
  causing recursive evaluation. The helper functions run with elevated
  privilege internally but only ever return the *calling user's own*
  tenant/role — they don't leak anything.
- **Master vs. tenant catalog**: `products.tenant_id IS NULL` means "shared
  master catalog," editable only by `super_admin`. A store's `office` role
  can add tenant-specific products (`tenant_id` = their own) alongside the
  master ones. If you don't need multi-tenant catalog forking, you can
  simplify this later — it's more flexibility than a single-store
  deployment needs today.
