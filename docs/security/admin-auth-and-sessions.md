# Admin Auth And Sessions

## Current Model

- admin login is separate from normal user auth
- login happens at `/login`
- successful login sets a signed HTTP-only admin session cookie
- session state is backed by `admin_sessions`

## Session Controls

- idle timeout
- absolute expiration
- session revocation
- logout-all behavior
- recent sensitive-auth timestamp for high-risk actions
- IP allowlist checks for selected admin accounts

## Why Middleware Is Not Enough

The current app allows `/api/*` and auth callback surfaces to pass middleware. Because of that:

- every API route must validate admin session internally
- every sensitive server action must validate admin session internally
- every sensitive path must enforce permissions server-side

## High-Risk Actions

Recent re-auth is currently used for actions like:

- admin role/status changes
- user suspension / banning / reactivation
- export creation
- finance mutations
- internal config changes
