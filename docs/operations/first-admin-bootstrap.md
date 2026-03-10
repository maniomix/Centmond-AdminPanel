# First Admin Bootstrap

## Current Safe Path

Use the database functions and tables already established by the admin ops migrations.

Important existing function:

- `public.admin_create_user(...)`

## Recommended Bootstrap Flow

1. Apply all current migrations.
2. Confirm system roles exist in `admin_roles`.
3. Create the first admin through `admin_create_user(...)`.
4. Assign the intended role in `admin_user_roles` if not already assigned.
5. Sign in at `/login`.
6. Manage further admin accounts through `/admin/admins`.

## Important Rules

- do not store plaintext passwords
- do not manually invent parallel admin tables
- do not skip role assignment
- do not expose bootstrap credentials in client code
- rotate bootstrap credentials immediately if they were temporary
