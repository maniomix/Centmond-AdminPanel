# Contributing

## Scope

This repository is an internal admin operations platform. Extend the existing app in place. Do not create parallel route areas or a second admin app.

## Security Rules

- Do not bypass server-side permission checks.
- Do not add sensitive mutations without audit logging.
- Do not rely on middleware alone for admin protection.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` to any client bundle.
- Do not move sensitive admin writes into client-side code.
- Do not add destructive actions without confirmation and reason capture where appropriate.
- Do not weaken recent re-auth requirements for high-risk actions.

## Data And Schema Rules

- Use migrations for every schema change.
- Do not introduce manual schema drift in production.
- Keep RBAC changes synchronized across constants, migrations, docs, and tests.
- Preserve the separation between self-service settings and org-wide operational controls.

## Architecture Rules

- Prefer extending current modules over creating duplicates.
- Keep pages thin where possible.
- Keep server writes behind validated actions and reusable services.
- Keep the internal-tool visual direction serious and restrained.

## Quality Expectations

Before submitting changes, run:

```bash
npm run verify
```

If you change:

- schema: update migrations and relevant docs
- permissions: update constants, migrations, docs, and tests
- auth/session behavior: update security docs and tests
- new operational modules: document current status honestly
