# Centmond Admin Panel - Memory

## Project Overview
Next.js 14 (App Router) admin panel with Supabase backend. Located at `/Users/mani/Desktop/Centmond-AdminPanel`.

## Tech Stack
- Next.js 14 (App Router, TypeScript)
- Supabase (Auth + Postgres DB)
- Tailwind CSS + shadcn/ui components
- react-hook-form + zod validation
- sonner (toasts)

## Key Architecture
- `app/(admin)/` — protected admin routes (layout checks auth + role)
- `app/login/` — login page (with Suspense wrapper around LoginForm)
- `middleware.ts` — checks auth AND `admin/editor` role for all protected routes
- `lib/supabase/client.ts` — browser client
- `lib/supabase/server.ts` — server client
- `lib/supabase/admin.ts` — service role client (server only)
- `components/ui/` — shadcn UI components
- `components/layout/` — Sidebar, Topbar
- `components/shared/` — DataTable, Pagination, SearchFilter, PageHeader, DeleteDialog

## Database Schema (public schema)
- `users` — mirrors auth.users, has `role` (admin/editor/viewer), `status` (active/inactive/suspended)
- `orders` — customer orders with JSONB items
- `content` — CMS content with slug, body, status
- `activity_logs` — audit trail

## Security Model (IMPORTANT)
- Only users with `role = 'admin'` or `role = 'editor'` can access the admin panel
- Enforcement is at 3 layers: middleware, admin layout server component, login form client-side check
- Regular app users (role = 'viewer') are blocked and signed out with "access_denied" error
- Promote users to admin/editor via: Users page > user detail > edit role, or Settings > Admin Access
- First admin must be set manually in Supabase SQL: `UPDATE public.users SET role = 'admin' WHERE id = 'uuid';`

## Pages Built
- `/dashboard` — stats cards + recent activity
- `/admin/users` — list with search/filter/sort/pagination
- `/admin/users/[id]` — user detail + edit + recent orders
- `/admin/orders` — list with filters
- `/admin/orders/[id]` — order detail + status update
- `/admin/content` — list with create button
- `/admin/content/new` — handled by `/admin/content/[id]/page.tsx` (id === "new")
- `/admin/content/[id]` — edit content
- `/admin/activity-logs` — audit log with filter/pagination
- `/admin/settings` — profile, account info, Admin Access (admin-only card)

## Patterns
- Server components fetch data, pass to client components for interactivity
- URL-based state for filters/pagination (searchParams)
- ActivityLogsClient uses `children` prop to wrap server-rendered content between filter and pagination
- Badge variants: default, secondary, success, warning, destructive, outline, info
