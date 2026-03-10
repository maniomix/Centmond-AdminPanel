# Audit Logging

## Purpose

Audit logs are for sensitive admin actions and traceability, not general product activity.

Current storage:

- `admin_audit_logs`

## Current Audit Fields

- actor admin
- actor role
- action type
- category
- severity
- target entity
- reason
- before / after state
- request id
- IP and user agent
- approval metadata when present

## Fail-Closed Rule

Critical actions should not succeed if required audit logging fails.

Non-critical optional audit writes may degrade more softly in local development, but that is not a valid production mode.

## Contributor Rule

Do not add sensitive mutations without an audit strategy.
