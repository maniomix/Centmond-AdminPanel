# RBAC Permission Model

## Current Roles

System roles currently supported:

- `super_admin`
- `operations_admin`
- `support_admin`
- `finance_admin`
- `moderation_admin`
- `analyst`

Legacy compatibility roles still exist in the data model:

- `admin` -> maps into `operations_admin`
- `viewer` -> maps into `analyst`

## Permission Sources

The permission model is defined across:

- [lib/admin/constants.ts](/Users/mani/Desktop/Centmond-AdminPanel/lib/admin/constants.ts)
- [lib/admin/permissions.ts](/Users/mani/Desktop/Centmond-AdminPanel/lib/admin/permissions.ts)
- phase 1 and follow-up migrations under [supabase/migrations](/Users/mani/Desktop/Centmond-AdminPanel/supabase/migrations)

## Important Permission Groups

- dashboard and read access: `dashboard.view`, `users.view`, `subscriptions.view`, `billing.view`
- user lifecycle: `users.edit`, `users.suspend`, `users.ban`, `users.reactivate`, `users.soft_delete`
- user security: `user_sessions.view`, `user_sessions.manage`
- reviews and risk: `review_queue.manage`, `risk.view`, `risk.manage`, `flags.manage`
- admin access: `admins.view`, `admins.create`, `admins.edit`, `admins.deactivate`, `admins.sessions.manage`, `roles.assign`
- finance and exports: `finance.view`, `finance.manage`, `finance.notes.manage`, `exports.view`, `exports.manage`
- config: `feature_flags.view`, `feature_flags.manage`, `internal_settings.view`, `internal_settings.manage`, `settings.manage`
- support workflow: `support_handoffs.manage`

## Compatibility Notes

The repository currently keeps a small compatibility layer for older permission keys while the schema catches up:

- `users.sessions.manage` is treated as equivalent to `user_sessions.manage`
- `reviews.manage` is treated as equivalent to `review_queue.manage`
- `exports.run` is treated as equivalent to `exports.manage`

New pages and actions should prefer the explicit `view` / `manage` keys.

## Enforcement Rules

- page visibility must not be treated as sufficient protection
- server actions and API routes must always enforce permissions directly
- new permissions must be added consistently across constants, migrations, docs, and tests

## Current Gaps

The model is active and used in production code. Remaining future-phase work is about:

- approvals
- impersonation
- more granular export approval flows
