# Migrations And Seeding

## Source Of Truth

All schema changes must go through:

- [supabase/migrations](/Users/mani/Desktop/Centmond-AdminPanel/supabase/migrations)

Important current migrations:

- `20260310_phase1_admin_ops.sql`
- `20260310_phase1_hardening_followup.sql`
- `20260310_phase2_ops_foundations.sql`

## Apply Order

Apply migrations in timestamp order. Do not cherry-pick around missing earlier migrations.

## What The Migrations Currently Establish

- admin auth/session tables
- RBAC roles and permissions
- audit logging tables
- notes, tags, flags, saved views
- phase 2 ops tables for sessions/devices, finance, exports, config, and review queue

## Seeding Expectations

Current migrations also seed:

- system roles
- system permissions
- baseline role-permission assignments
- core system tags and flags

Do not re-seed these manually in ad-hoc scripts unless you are intentionally writing a migration.
