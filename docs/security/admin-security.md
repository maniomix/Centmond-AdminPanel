# Admin Security Notes

## Core Rules

- admin auth is separate from regular user auth
- service-role access is server-only
- middleware is not treated as sufficient authorization
- every sensitive mutation must validate session and permission server-side

## Session Controls

- signed HTTP-only cookie
- DB-backed admin session records
- idle timeout and absolute expiration
- session revocation
- recent sensitive-auth timestamp for high-risk actions
- IP allowlist support for selected admins

## Mutation Controls

Shared mutation wrapper responsibilities:

- same-origin enforcement
- permission enforcement
- optional recent re-auth enforcement
- audit logging
- path revalidation
- normalized error handling

## Audit Behavior

- critical actions should be fail-closed
- optional audit writes are soft-failed only for non-critical paths
- missing audit table in local dev is not a valid production state

## Current Gaps Still Planned

- MFA rollout is only architecture-ready, not fully enforced
- approvals and impersonation are future phases
- finance/export approval workflows are not complete yet

## Phase 2 Additions

- export download routes validate admin session and permission on every request
- high-risk config surfaces now live outside self-service settings
- user session/device views are backed by dedicated tables instead of only inferred event streams
