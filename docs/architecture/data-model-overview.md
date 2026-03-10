# Data Model Overview

## Core Admin Tables

- `admin_users`
- `admin_roles`
- `admin_permissions`
- `admin_role_permissions`
- `admin_user_roles`
- `admin_sessions`
- `admin_login_attempts`
- `admin_audit_logs`

## Core User Operations Tables

- `users`
- `subscriptions`
- `transactions`
- `events`
- `user_notes`
- `user_tags`
- `user_tag_assignments`
- `user_flags`
- `user_flag_assignments`
- `saved_views`

## Phase 2 Ops Tables

- `user_devices`
- `user_sessions`
- `finance_events`
- `support_handoffs`
- `bulk_jobs`
- `export_jobs`
- `feature_flags`
- `internal_settings`
- `review_queue_items`

## Table Intent

- `admin_audit_logs`: compliance-style record of sensitive admin actions
- `events` / `activity_logs`: operational and product activity stream
- `user_sessions` / `user_devices`: real session and device visibility
- `finance_events`: internal operator-facing finance records
- `bulk_jobs` / `export_jobs`: queued operational actions and outputs
- `review_queue_items`: explicit review workflow state

## Migration Discipline

Schema changes must be made through `supabase/migrations/*.sql`. Keep code, types, docs, and permissions synchronized with every schema change.
