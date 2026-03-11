# Finance And Ops Modules

## Finance

`/admin/finance` is the operator-facing finance surface for the current repository.

Current implementation:

- reads current `subscriptions`, `transactions`, `finance_events`, and finance notes
- records internal finance events through audited admin mutations
- stays provider-ready rather than provider-coupled

Important constraint:

- recording a finance event does not call Stripe / Apple / any provider directly
- provider-backed refund, cancel, and reconciliation flows remain a later integration layer

## Exports

`/admin/exports` is the controlled export center.

Current implementation:

- export jobs are stored in `export_jobs`
- export history requires `exports.view`
- export generation and downloads require `exports.manage`
- export creation requires recent re-auth
- completed files are served through authenticated admin routes

Current scopes:

- users
- subscriptions
- audit logs
- review queue

## Feature Flags And Internal Settings

Separate the concerns:

- `/admin/settings`: self-service admin profile, password, and own sessions
- `/admin/feature-flags`: operational feature toggles
- `/admin/internal-settings`: org-wide internal configuration

Both operational config surfaces:

- require dedicated permissions
- use server-side mutation enforcement
- require audit logging
- require recent re-auth before changes

## Bulk Jobs

Bulk user mutations now create `bulk_jobs` records before execution.

Current shape:

- job record is created
- job enters `processing`
- inline executor updates the job to `completed` or `failed`

This is intentionally worker-ready so later background processing can reuse the same contract.
