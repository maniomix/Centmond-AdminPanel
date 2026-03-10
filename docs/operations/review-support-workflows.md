# Review And Support Workflows

## Review Queue

`/admin/reviews` now centers on `review_queue_items` instead of only inferring queue state from user status.

Current review states:

- `under_review`
- `escalated`
- `approved`
- `rejected`
- `restricted`
- `false_positive`
- `resolved`

Current behavior:

- review decisions require server-side permission enforcement
- sensitive decisions are audited
- queue state is visible independently from the raw user record

## Support Handoffs

User detail pages can record support handoffs through `support_handoffs`.

Use handoffs for:

- internal ownership transfer
- escalation context
- follow-up responsibilities
- cross-functional coordination

Handoffs are not a replacement for notes:

- notes capture free-form operational context
- handoffs capture ownership and follow-up state
