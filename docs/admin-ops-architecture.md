# Admin Ops Platform Architecture

## Proposed Folder Structure

```text
app/
  (admin)/
    layout.tsx
    dashboard/
    admin/
      users/
      admins/
      subscriptions/
      audit-logs/
      search/
      reviews/
      support/
      segments/
      settings/
  api/
    admin/
      login/
      logout/
      sessions/
      search/
      csrf/

components/
  admin/
    actions/
    admins/
    audit/
    notes/
    search/
    users/
  layout/
  shared/
  ui/

lib/
  admin/
    audit.ts
    auth.ts
    constants.ts
    env.ts
    permissions.ts
    security.ts
    services/
      admins.ts
      users.ts
      search.ts
  supabase/
  utils.ts

supabase/
  migrations/
    20260310_phase1_admin_ops.sql
  schema.sql

types/
  admin.ts
  database.ts
  index.ts

docs/
  admin-ops-architecture.md
```

## Database Schema Plan

### Existing Tables To Reuse

- `users`
- `subscriptions`
- `transactions`
- `events`
- `content`
- `orders`

### Existing Tables To Refactor

- `admin_users`
  - add `email`
  - add `status`
  - add security metadata (`mfa_enabled`, `last_password_change_at`, `must_reauth_after`, `failed_login_count`, `last_failed_login_at`)
  - keep legacy `role` for compatibility during transition, but move effective access to role tables
- `admin_sessions`
  - move from naive token storage to hashed session token storage
  - add `last_seen_at`, `idle_expires_at`, `revoked_at`, `revoked_reason`, `ip_address`, `user_agent`, `device_label`

### New Phase 1 Tables

- `admin_roles`
- `admin_permissions`
- `admin_role_permissions`
- `admin_user_roles`
- `admin_login_attempts`
- `admin_audit_logs`
- `user_notes`
- `user_tags`
- `user_tag_assignments`
- `user_flags`
- `user_flag_assignments`
- `saved_views`

### Phase 2 Ready Tables

- `review_queue_items`
- `user_risk_profiles`
- `user_risk_events`
- `user_sessions`
- `user_devices`
- `support_threads`
- `support_handoffs`
- `bulk_jobs`
- `export_jobs`
- `feature_flags`
- `internal_settings`
- `impersonation_sessions`

### Users Table Extensions

Add nullable operational fields:

- `status`
- `phone`
- `phone_verified`
- `username`
- `full_name`
- `auth_provider`
- `last_login_at`
- `country_code`
- `region`
- `locale`
- `billing_status`
- `risk_score`
- `risk_status`
- `referral_code`
- `referred_by_code`
- `onboarding_status`
- `vip_status`
- `deleted_at`

### Indexing Priorities

- `users(email, username, status, created_at desc, last_active_at desc)`
- `admin_sessions(admin_id, revoked_at, expires_at)`
- `admin_audit_logs(created_at desc, actor_admin_id, target_entity_type, target_entity_id, category)`
- `user_notes(user_id, created_at desc, note_type)`
- `user_tag_assignments(user_id, tag_id)`
- `user_flag_assignments(user_id, flag_id, status)`
- `saved_views(owner_admin_id, scope, updated_at desc)`

## RBAC Permission Matrix

### Permission Keys

- `dashboard.view`
- `users.view`
- `users.edit`
- `users.suspend`
- `users.ban`
- `users.reactivate`
- `users.soft_delete`
- `users.sessions.manage`
- `users.impersonate`
- `users.export`
- `subscriptions.view`
- `subscriptions.manage`
- `billing.view`
- `billing.refunds.issue`
- `finance.notes.manage`
- `support.view`
- `support.notes.manage`
- `tags.manage`
- `flags.manage`
- `risk.view`
- `risk.manage`
- `reviews.manage`
- `audit_logs.view`
- `admins.view`
- `admins.create`
- `admins.edit`
- `admins.deactivate`
- `roles.assign`
- `permissions.manage`
- `saved_views.manage`
- `bulk_actions.run`
- `feature_flags.manage`
- `settings.manage`
- `exports.run`

### System Roles

| Role | Access Summary |
| --- | --- |
| `super_admin` | All permissions |
| `operations_admin` | Users, subscriptions, tags, flags, notes, bulk actions, saved views, audit read |
| `support_admin` | Users read/edit, support notes, tags, flags, session management, no finance/admin management |
| `finance_admin` | Billing, subscriptions, refunds, finance notes, audit read, exports limited |
| `moderation_admin` | Users read, suspend, ban, reactivate, risk/review, flags, notes |
| `analyst` | Read-only for dashboard, users, subscriptions, support, audit, risk |

### Sensitive Actions Requiring Extra Controls

- admin creation/deactivation
- role assignment
- refund issuance
- export of sensitive data
- user impersonation
- force logout all sessions
- user ban / soft delete

For these actions Phase 1 implementation uses:

- server-side permission enforcement
- explicit confirmation
- reason capture
- audit logging

Phase 2 extends this with:

- re-authentication gates
- approval workflows

## Implementation Phases

### Phase 1

- secure admin auth/session hardening
- env validation and security helpers
- RBAC infrastructure
- admin management pages
- user list improvements
- user 360 enhancements
- notes/tags/flags
- audit logs
- global search

### Phase 2

- timeline/event feed unification
- device/session visibility for users
- billing and finance operations tooling
- saved views and segmentation
- bulk operations
- support workflows
- risk/review basics

### Phase 3

- impersonation
- export jobs
- feature flags / internal settings
- approval workflows
- advanced fraud/risk automation
- queueing / background jobs

## Pages / Routes / Components To Add

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
