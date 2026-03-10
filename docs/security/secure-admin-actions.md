# Secure Admin Actions

## Minimum Requirements

Every sensitive admin mutation should have:

- server-side session validation
- server-side permission enforcement
- input validation
- same-origin protection
- audit logging
- reason capture where appropriate
- recent re-auth when the action is high risk

## Shared Wrapper

Current sensitive action handling is centered on:

- [lib/admin/mutations.ts](/Users/mani/Desktop/Centmond-AdminPanel/lib/admin/mutations.ts)

Prefer extending this pattern rather than building custom one-off enforcement flows.

## Unsafe Patterns To Avoid

- relying on hidden buttons as protection
- checking permissions only in client components
- performing admin writes from browser-exposed credentials
- adding schema changes without migrations
- introducing new config surfaces inside self-service settings
