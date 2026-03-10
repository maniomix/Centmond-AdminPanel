# Data Access And Exports

## Server-Side Rules

- no export generation is performed client-side
- download routes validate the current admin session on the server
- export access requires `exports.run`
- export creation is audited

## Export Lifecycle

1. An admin creates an export job from `/admin/exports`.
2. The server records the job in `export_jobs`.
3. The export is generated server-side.
4. The completed job becomes downloadable through `/api/admin/exports/[id]`.
5. The file expires after a short retention window.

## Operational Guidance

- require a reason for every export
- prefer narrow scopes
- treat audit-log exports as especially sensitive
- never bypass the exports center with ad-hoc scripts in production
