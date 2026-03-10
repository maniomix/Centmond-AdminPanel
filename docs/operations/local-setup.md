# Local Setup

## Requirements

- Node.js 25.x currently works in this workspace
- npm
- Supabase project access with service-role credentials

## Environment Variables

Required:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_JWT_SECRET`

Optional but recommended:

- `ADMIN_SESSION_IDLE_MINUTES`
- `ADMIN_SESSION_ABSOLUTE_HOURS`
- `ADMIN_SENSITIVE_ACTION_WINDOW_MINUTES`
- `ADMIN_LOGIN_RATE_LIMIT_WINDOW_MINUTES`
- `ADMIN_LOGIN_RATE_LIMIT_MAX_ATTEMPTS`

## Startup

```bash
npm install
npm run dev
```

## Verification

Run:

```bash
npm run verify
```

This executes lint, typecheck, and the baseline tests.

## Bootstrap Notes

- apply migrations first
- create the initial admin through the repo’s supported admin bootstrap path
- sign in at `/login`
- manage access from `/admin/admins`, not `/admin/settings`
