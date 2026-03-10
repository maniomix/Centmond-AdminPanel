# Admin Ops Platform Architecture

This legacy top-level document is kept as an index. Prefer the structured docs under:

- [docs/architecture/admin-ops-architecture.md](/Users/mani/Desktop/Centmond-AdminPanel/docs/architecture/admin-ops-architecture.md)
- [docs/architecture/rbac-permission-model.md](/Users/mani/Desktop/Centmond-AdminPanel/docs/architecture/rbac-permission-model.md)
- [docs/architecture/data-model-overview.md](/Users/mani/Desktop/Centmond-AdminPanel/docs/architecture/data-model-overview.md)
- [docs/roadmap/implementation-phases.md](/Users/mani/Desktop/Centmond-AdminPanel/docs/roadmap/implementation-phases.md)

This document now acts as the high-level planning companion to the live implementation.

Use the newer docs for day-to-day maintainer guidance:

- [architecture overview](/Users/mani/Desktop/Centmond-AdminPanel/docs/architecture/overview.md)
- [local setup](/Users/mani/Desktop/Centmond-AdminPanel/docs/operations/local-setup.md)
- [security notes](/Users/mani/Desktop/Centmond-AdminPanel/docs/security/admin-security.md)

## Current Direction

- keep the existing app and route structure
- harden auth, sessions, permissions, and audits in place
- preserve working modules
- replace redirect shells only when real server-backed modules are ready

## Immediate Priorities

- Phase 1: auth/session hardening, unified permission enforcement, fail-closed audits for critical mutations, docs, tests
- Phase 2: finance, real user sessions/devices, bulk jobs, exports center, feature flags, internal settings, support handoffs
- Phase 3: approvals, impersonation, advanced risk and watchlists

## Existing Real Modules

- dashboard
- users and user detail
- admins and admin detail
- subscriptions
- finance
- reviews
- search
- segments
- exports
- audit logs
- activity logs
- feature flags
- internal settings
- self-service settings

## Redirect Shells To Keep Hidden Until Ready

- orders
- content

### Pages / Routes

- `/admin/admins`
- `/admin/admins/[id]`
- `/admin/audit-logs`
- `/admin/search`
- `/admin/users/[id]/notes`
- `/admin/users/[id]/risk`
- `/admin/users/[id]/sessions`
- `/api/admin/logout-all`
- `/api/admin/search`

### Components

- `components/admin/admins/admins-table.tsx`
- `components/admin/admins/admin-role-badge.tsx`
- `components/admin/audit/audit-log-table.tsx`
- `components/admin/search/global-search-form.tsx`
- `components/admin/notes/user-notes-panel.tsx`
- `components/admin/notes/user-tags-panel.tsx`
- `components/admin/notes/user-flags-panel.tsx`
- `components/admin/users/user-security-panel.tsx`
- `components/admin/users/user-audit-panel.tsx`
- `components/admin/actions/reason-dialog.tsx`

## Immediate Build Strategy

1. Introduce the new `lib/admin/*` security and RBAC layer without breaking current routes.
2. Add migration-based schema for roles, sessions, audit, notes, tags, flags, and saved views.
3. Rewire login/session validation to DB-backed sessions.
4. Add admin management module.
5. Add global search and audit log pages.
6. Extend user detail with collaboration and traceability panels.
