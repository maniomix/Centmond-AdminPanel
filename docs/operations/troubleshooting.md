# Troubleshooting

## Missing `admin_audit_logs`

Symptom:

- dev overlay or warnings around audit writes

Fix:

- apply the Supabase migrations
- confirm `public.admin_audit_logs` exists

## Settings Page Not Opening

Possible causes:

- stale Turbopack cache
- missing admin schema columns on local DB

Fix:

- restart `npm run dev`
- hard refresh the browser
- apply latest migrations

## Permission Errors

Check:

- admin has an active account status
- the correct role is assigned in `admin_user_roles`
- the permission exists in `admin_permissions`
- the role is mapped in `admin_role_permissions`

## Online User Count Looks Wrong

The current implementation now requires recent session activity that has not been explicitly closed. If results still look wrong:

- confirm incoming events include `session_id`
- check for missing `session_end` / `app_closed` style events

## Old UI Still Shows

Turbopack can cache prior overlays and layout output.

Fix:

- restart the dev server
- hard refresh the page
