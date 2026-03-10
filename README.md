# Centmond Admin Ops Panel

Internal admin operations platform built on the existing `Next.js + React + TypeScript + Tailwind + Supabase` stack. This repository extends the current admin panel in place; it is not a separate admin app.

## Current Scope

- Separate admin login and signed HTTP-only admin session cookie
- DB-backed admin sessions and login-attempt tracking
- Role-based admin permissions
- Admin modules for users, admins, subscriptions, reviews, search, segments, audit logs, activity logs, and self-service settings
- User notes, tags, flags, saved views, and review tooling
- Audit logging with fail-closed support for critical mutations
- Shared mutation wrapper for hardened admin actions

## Stack

- `Next.js 16`
- `React 19`
- `TypeScript`
- `Tailwind CSS 4`
- `Supabase / Postgres`

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create or update `.env.local` with the required values:

```env
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_JWT_SECRET=

ADMIN_SESSION_IDLE_MINUTES=30
ADMIN_SESSION_ABSOLUTE_HOURS=12
ADMIN_SENSITIVE_ACTION_WINDOW_MINUTES=15
ADMIN_LOGIN_RATE_LIMIT_WINDOW_MINUTES=15
ADMIN_LOGIN_RATE_LIMIT_MAX_ATTEMPTS=10
```

3. Apply Supabase schema and migrations.

4. Bootstrap at least one admin account.

5. Start the app:

```bash
npm run dev
```

Admin login remains at `/login`.

## Scripts

- `npm run dev`: run the Turbopack dev server
- `npm run lint`: lint the repository
- `npm run typecheck`: run TypeScript without emitting
- `npm run test`: run unit + smoke test suites
- `npm run test:unit`: run pure unit tests
- `npm run test:e2e`: run baseline hardening smoke tests
- `npm run verify`: run lint + typecheck + tests
- `npm run build`: production build

## Migrations

Current admin ops schema lives in:

- [supabase/migrations/20260310_phase1_admin_ops.sql](/Users/mani/Desktop/Centmond-AdminPanel/supabase/migrations/20260310_phase1_admin_ops.sql)
- [supabase/migrations/20260310_phase1_hardening_followup.sql](/Users/mani/Desktop/Centmond-AdminPanel/supabase/migrations/20260310_phase1_hardening_followup.sql)

Apply them through your existing Supabase workflow before expecting:

- `admin_audit_logs`
- `admin_roles` / `admin_permissions`
- `admin_sessions.last_sensitive_auth_at`
- the expanded permission set

If migrations are not applied, optional audit writes will be skipped in dev, but critical fail-closed mutations may still reject.

## First Admin Bootstrap

Use the DB function / seed path already present in this repository rather than creating admin rows manually. The important rules:

- create admins only in `admin_users`
- assign at least one role in `admin_user_roles`
- keep `ADMIN_JWT_SECRET` private and server-only
- never expose the service-role key to the browser

After bootstrap, sign in at `/login`, then manage org-wide admin access under `/admin/admins`.

## RBAC Overview

System roles currently supported:

- `super_admin`
- `operations_admin`
- `support_admin`
- `finance_admin`
- `moderation_admin`
- `analyst`

Legacy compatibility roles still map into the system model:

- `admin` -> `operations_admin`
- `viewer` -> `analyst`

Key permission groups include:

- dashboard, users, subscriptions, billing
- admins and admin session management
- audit logs and activity logs
- orders/content management
- saved views and bulk actions
- feature flags / internal settings / approvals

See:

- [docs/architecture/overview.md](/Users/mani/Desktop/Centmond-AdminPanel/docs/architecture/overview.md)
- [docs/security/admin-security.md](/Users/mani/Desktop/Centmond-AdminPanel/docs/security/admin-security.md)

## Security Notes

- Middleware/proxy is not trusted as the sole enforcement layer.
- Sensitive admin mutations enforce server-side permission checks.
- State-changing actions use same-origin protection.
- High-risk actions can require recent password confirmation.
- Critical mutations are expected to fail closed if required audit logging fails.
- Service-role access must stay on the server.

## Audit Logging

Two streams are intentionally separate:

- `Audit logs`: sensitive admin actions and traceability
- `Activity logs`: operational/product/user event stream

Missing `admin_audit_logs` in local dev no longer hard-crashes optional reads/writes, but the correct fix is still to apply migrations.

## Route Status

Real modules today:

- `/dashboard`
- `/admin/users`
- `/admin/users/[id]`
- `/admin/admins`
- `/admin/admins/[id]`
- `/admin/subscriptions`
- `/admin/reviews`
- `/admin/search`
- `/admin/segments`
- `/admin/audit-logs`
- `/admin/activity-logs`
- `/admin/settings`

Current redirect shells:

- `/admin/orders`
- `/admin/orders/[id]`
- `/admin/content`

These should stay hidden or clearly treated as placeholders until they are backed by real list/detail flows.

## Documentation Map

- [docs/architecture/overview.md](/Users/mani/Desktop/Centmond-AdminPanel/docs/architecture/overview.md)
- [docs/operations/local-setup.md](/Users/mani/Desktop/Centmond-AdminPanel/docs/operations/local-setup.md)
- [docs/operations/troubleshooting.md](/Users/mani/Desktop/Centmond-AdminPanel/docs/operations/troubleshooting.md)
- [docs/security/admin-security.md](/Users/mani/Desktop/Centmond-AdminPanel/docs/security/admin-security.md)
- [docs/admin-ops-architecture.md](/Users/mani/Desktop/Centmond-AdminPanel/docs/admin-ops-architecture.md)

## Deployment Notes

- Keep `SUPABASE_SERVICE_ROLE_KEY` server-only.
- Use a production-grade `ADMIN_JWT_SECRET` with at least 32 characters.
- Apply migrations before deploying new code that relies on new permissions or audit/session columns.
- Treat audit table availability as part of deployment readiness.

## Troubleshooting

- `Settings` redirects or renders partially: confirm the latest admin migrations are applied.
- `admin_audit_logs` missing: apply migrations; optional audit writes are skipped in dev but not a substitute for schema sync.
- Old UI still appears after a fix: restart the dev server and hard refresh; Turbopack can cache stale overlays.
- Permission denied on a visible screen: the page UI may render from one permission while the action uses a stricter permission; check the current role assignment in `/admin/admins`.
