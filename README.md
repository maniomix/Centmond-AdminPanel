# Centmond Admin Ops Platform

Internal admin operations platform for Centmond, built in place on the current `Next.js + React + TypeScript + Tailwind + Supabase` stack.

This repository is not a starter app and not a separate admin rewrite. It extends the existing admin surface into a production-minded internal tool for secure admin access, user operations, subscriptions, finance workflows, reviews, exports, auditability, and operational configuration.

## Who This Is For

- internal operators
- support and moderation admins
- finance and operations admins
- maintainers extending the admin platform safely

## Current Stack

- `Next.js 16`
- `React 19`
- `TypeScript`
- `Tailwind CSS 4`
- `Supabase / Postgres`
- server actions and route handlers for admin mutations

## Current Module Surface

Implemented modules:

- `/login`
- `/dashboard`
- `/admin/users`
- `/admin/users/[id]`
- `/admin/admins`
- `/admin/admins/[id]`
- `/admin/subscriptions`
- `/admin/finance`
- `/admin/reviews`
- `/admin/search`
- `/admin/segments`
- `/admin/audit-logs`
- `/admin/activity-logs`
- `/admin/exports`
- `/admin/feature-flags`
- `/admin/internal-settings`
- `/admin/settings`

Existing shells still present but not yet production modules:

- `/admin/orders`
- `/admin/orders/[id]`
- `/admin/content`

## Implementation Status

### Implemented Now

- separate admin login flow at `/login`
- signed HTTP-only admin session cookies
- DB-backed admin sessions and login-attempt tracking
- RBAC foundations and server-side permission checks
- admin audit logs with fail-closed behavior for critical mutations
- user notes, tags, flags, saved views, review tooling
- finance overview module
- controlled exports center
- feature flags and internal settings modules
- real user session/device data model
- bulk jobs and export jobs foundations
- maintainer docs, verify script, and baseline unit/E2E coverage

### Partially Implemented

- reviews and risk workflows are real, but still not the final approval-grade workflow engine
- finance is operator-facing and provider-ready, but not fully provider-backed
- user session/device panels are backed by real tables, but still depend on upstream product-side session producers
- exports are controlled and audited, but approvals are not yet layered on top

### Planned Next

- approvals for sensitive actions
- guarded impersonation
- advanced risk workflows and watchlists
- deeper analytics and alerting
- background workers for `bulk_jobs` and `export_jobs`
- turning orders/content shells into real operational modules

## Auth And Session Model

High-level admin auth model:

- admin auth is separate from normal user auth
- login happens at `/login`
- successful login creates a signed HTTP-only session cookie
- server-side session state is stored in `admin_sessions`
- sessions support idle timeout, absolute expiration, revocation, and recent sensitive-auth timestamps
- high-risk mutations can require recent password confirmation

Important:

- middleware is not treated as sufficient authorization
- API routes and server actions must validate session and permission internally

See:

- [admin auth and sessions](/Users/mani/Desktop/Centmond-AdminPanel/docs/security/admin-auth-and-sessions.md)
- [admin security notes](/Users/mani/Desktop/Centmond-AdminPanel/docs/security/admin-security.md)

## RBAC And Permission Model

Current system roles:

- `super_admin`
- `operations_admin`
- `support_admin`
- `finance_admin`
- `moderation_admin`
- `analyst`

Legacy compatibility roles:

- `admin`
- `viewer`

Permission enforcement rules:

- page access is not enough
- client-side hiding is not enough
- sensitive actions must enforce permissions on the server
- new permissions must be synchronized across code, migrations, docs, and tests

See:

- [RBAC permission model](/Users/mani/Desktop/Centmond-AdminPanel/docs/architecture/rbac-permission-model.md)
- [secure admin actions](/Users/mani/Desktop/Centmond-AdminPanel/docs/security/secure-admin-actions.md)

## Audit And Activity Model

Two streams are intentionally separate:

- `audit logs`: sensitive admin actions, reasons, before/after state, and traceability
- `activity logs`: user/product/operational event stream

Critical admin mutations should fail closed if required audit logging fails.

See:

- [audit logging](/Users/mani/Desktop/Centmond-AdminPanel/docs/security/audit-logging.md)

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Create local environment config

```bash
cp .env.example .env.local
```

Required variables:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_JWT_SECRET=
```

Optional overrides:

```env
ADMIN_SESSION_IDLE_MINUTES=30
ADMIN_SESSION_ABSOLUTE_HOURS=12
ADMIN_SENSITIVE_ACTION_WINDOW_MINUTES=15
ADMIN_LOGIN_RATE_LIMIT_WINDOW_MINUTES=15
ADMIN_LOGIN_RATE_LIMIT_MAX_ATTEMPTS=10
```

### 3. Apply migrations

Current migrations:

- [20260310_phase1_admin_ops.sql](/Users/mani/Desktop/Centmond-AdminPanel/supabase/migrations/20260310_phase1_admin_ops.sql)
- [20260310_phase1_hardening_followup.sql](/Users/mani/Desktop/Centmond-AdminPanel/supabase/migrations/20260310_phase1_hardening_followup.sql)
- [20260310_phase2_ops_foundations.sql](/Users/mani/Desktop/Centmond-AdminPanel/supabase/migrations/20260310_phase2_ops_foundations.sql)

Apply them through your normal Supabase migration workflow before expecting:

- RBAC tables and seeded permissions
- `admin_audit_logs`
- `admin_sessions.last_sensitive_auth_at`
- `user_sessions` / `user_devices`
- `finance_events`
- `bulk_jobs` / `export_jobs`
- `feature_flags` / `internal_settings`
- `review_queue_items`

### 4. Bootstrap the first admin

Use the existing DB-backed admin bootstrap path, not manual direct table edits.

Current safe bootstrap direction:

- apply migrations
- use `public.admin_create_user(...)`
- ensure a role exists in `admin_user_roles`
- sign in at `/login`
- manage further admins through `/admin/admins`

See:

- [first admin bootstrap](/Users/mani/Desktop/Centmond-AdminPanel/docs/operations/first-admin-bootstrap.md)
- [migrations and seeding](/Users/mani/Desktop/Centmond-AdminPanel/docs/operations/migrations-and-seeding.md)

### 5. Run the app

```bash
npm run dev
```

## Scripts

- `npm run dev`
  Runs the local Turbopack development server.

- `npm run build`
  Runs a production build.

- `npm run start`
  Starts the built production server.

- `npm run lint`
  Runs ESLint across the repository.

- `npm run typecheck`
  Runs TypeScript in `noEmit` mode.

- `npm run test`
  Runs `test:unit` and `test:e2e`.

- `npm run test:unit`
  Runs the pure unit test suite.

- `npm run test:e2e`
  Runs the smoke-level E2E/integration checks currently in the repo.

- `npm run verify`
  Runs the main quality gate: lint + typecheck + tests.

Current test status is honest and intentional:

- the repo has a real baseline
- coverage is still expanding
- tests currently focus on security-critical flows and module smoke coverage rather than complete product behavior

## Documentation Map

Start here:

- [docs index](/Users/mani/Desktop/Centmond-AdminPanel/docs/README.md)

Architecture:

- [admin ops architecture](/Users/mani/Desktop/Centmond-AdminPanel/docs/architecture/admin-ops-architecture.md)
- [RBAC permission model](/Users/mani/Desktop/Centmond-AdminPanel/docs/architecture/rbac-permission-model.md)
- [data model overview](/Users/mani/Desktop/Centmond-AdminPanel/docs/architecture/data-model-overview.md)
- [finance and ops modules](/Users/mani/Desktop/Centmond-AdminPanel/docs/architecture/finance-and-ops-modules.md)
- [overview](/Users/mani/Desktop/Centmond-AdminPanel/docs/architecture/overview.md)

Operations:

- [local development](/Users/mani/Desktop/Centmond-AdminPanel/docs/operations/local-development.md)
- [migrations and seeding](/Users/mani/Desktop/Centmond-AdminPanel/docs/operations/migrations-and-seeding.md)
- [first admin bootstrap](/Users/mani/Desktop/Centmond-AdminPanel/docs/operations/first-admin-bootstrap.md)
- [deployment notes](/Users/mani/Desktop/Centmond-AdminPanel/docs/operations/deployment-notes.md)
- [review and support workflows](/Users/mani/Desktop/Centmond-AdminPanel/docs/operations/review-support-workflows.md)
- [troubleshooting](/Users/mani/Desktop/Centmond-AdminPanel/docs/operations/troubleshooting.md)

Security:

- [admin auth and sessions](/Users/mani/Desktop/Centmond-AdminPanel/docs/security/admin-auth-and-sessions.md)
- [audit logging](/Users/mani/Desktop/Centmond-AdminPanel/docs/security/audit-logging.md)
- [secure admin actions](/Users/mani/Desktop/Centmond-AdminPanel/docs/security/secure-admin-actions.md)
- [data access and exports](/Users/mani/Desktop/Centmond-AdminPanel/docs/security/data-access-and-exports.md)
- [admin security notes](/Users/mani/Desktop/Centmond-AdminPanel/docs/security/admin-security.md)

Roadmap:

- [implementation phases](/Users/mani/Desktop/Centmond-AdminPanel/docs/roadmap/implementation-phases.md)

## Contributor And Maintainer Rules

Read [CONTRIBUTING.md](/Users/mani/Desktop/Centmond-AdminPanel/CONTRIBUTING.md) before changing security-sensitive code.

Non-negotiable expectations:

- do not bypass server-side permission enforcement
- do not add sensitive actions without audit logging
- do not expose the service-role key to clients
- use migrations for schema changes
- preserve settings vs admin-management boundaries
- extend existing modules instead of duplicating features
- keep the UI serious, restrained, and internal-tool oriented

## Important Security Warnings

- `SUPABASE_SERVICE_ROLE_KEY` must remain server-only
- `ADMIN_JWT_SECRET` must be long, random, and private
- missing migrations can break audited or permissioned flows
- optional dev-only audit degradation is not acceptable in production
- any new admin API route or mutation must enforce session and permission server-side

## Repository Maturity Notes

This repository is no longer a framework placeholder, but it is also not “done.” The current focus is production readiness through:

- stronger operational modules
- clearer documentation
- testable security patterns
- migration discipline
- contributor clarity

Future contributors should preserve that direction rather than starting fresh abstractions or parallel admin surfaces.
