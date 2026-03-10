# Architecture Overview

## What Stays

- Existing `app/(admin)` route spine
- Current Next.js / React / Tailwind / Supabase stack
- Existing admin modules that already have real operator value
- Current server-side admin auth/session foundation

## What Gets Hardened

- inconsistent mutation security
- legacy ad-hoc authorization paths
- missing or drifting permission keys
- scattered service-role access
- incomplete audit behavior
- placeholder documentation and missing tests

## Current Module Classification

Keep as real modules:

- users
- admins
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
- dashboard
- self-service settings

Treat as redirect shells until implemented:

- orders
- content

## Phase Structure

### Phase 1

- auth/session hardening
- permission consistency
- audit fail-closed for critical actions
- admin management consolidation
- user/admin/subscription action hardening
- scripts/tests/docs baseline

### Phase 2

- finance module
- real user sessions/devices
- bulk jobs
- exports center
- support handoffs
- feature flags
- internal settings

### Phase 3

- approvals
- impersonation
- advanced review/risk workflows
- watchlists / alerts

## Route IA

- Overview: dashboard, global search
- Operations: users, segments, reviews
- Revenue: subscriptions, finance, future orders
- Security: admins, audit logs, activity logs
- Configuration: settings, feature flags, internal settings, exports
