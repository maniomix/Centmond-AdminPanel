# Local Development

## Prerequisites

- Node.js compatible with the current Next.js version
- npm
- Supabase project access

## Environment

Copy the example file and set real values:

```bash
cp .env.example .env.local
```

Required variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_JWT_SECRET`

Optional operational overrides:

- `ADMIN_SESSION_IDLE_MINUTES`
- `ADMIN_SESSION_ABSOLUTE_HOURS`
- `ADMIN_SENSITIVE_ACTION_WINDOW_MINUTES`
- `ADMIN_LOGIN_RATE_LIMIT_WINDOW_MINUTES`
- `ADMIN_LOGIN_RATE_LIMIT_MAX_ATTEMPTS`

## Install And Run

```bash
npm install
npm run dev
```

Admin login is available at `/login`.

## Quality Workflow

```bash
npm run lint
npm run typecheck
npm run test
npm run verify
```
