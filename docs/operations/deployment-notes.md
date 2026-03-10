# Deployment Notes

## Before Deploying

- apply all migrations
- confirm required environment variables are present
- run `npm run verify`
- confirm `admin_audit_logs` exists
- confirm new permission keys exist when new code depends on them

## Secrets

- `SUPABASE_SERVICE_ROLE_KEY` must remain server-only
- `ADMIN_JWT_SECRET` must be long, random, and deployment-specific
- do not reuse weak local secrets in shared environments

## Operational Checks

- verify admin login works
- verify session validation works
- verify a critical audited mutation still fails closed if the audit write path is broken
- verify export downloads remain permission-gated

## Rollback Considerations

- code rollback without schema awareness can break newer pages
- if a release depends on a new table or column, treat migration state as part of deployment readiness
