ALTER TABLE public.admin_sessions
  ADD COLUMN IF NOT EXISTS last_sensitive_auth_at TIMESTAMPTZ;

UPDATE public.admin_sessions
SET last_sensitive_auth_at = COALESCE(last_sensitive_auth_at, created_at, NOW())
WHERE last_sensitive_auth_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_request_id
  ON public.admin_audit_logs (request_id);

CREATE INDEX IF NOT EXISTS idx_events_user_created_at_desc
  ON public.events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_updated_at_desc
  ON public.subscriptions (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_user_date_desc
  ON public.transactions (user_id, date DESC);

INSERT INTO public.admin_permissions (key, label, description)
VALUES
  ('activity_logs.view', 'View activity logs', 'Read operational and product activity logs'),
  ('admins.sessions.manage', 'Manage admin sessions', 'Revoke admin sessions and inspect session state'),
  ('orders.view', 'View orders', 'Read order data'),
  ('orders.manage', 'Manage orders', 'Update order state'),
  ('content.manage', 'Manage content', 'Create, update, and delete internal content'),
  ('finance.manage', 'Manage finance operations', 'Run finance workflows and exceptions'),
  ('internal_settings.manage', 'Manage internal settings', 'Update internal settings'),
  ('approvals.manage', 'Manage approvals', 'Review and approve sensitive actions')
ON CONFLICT (key) DO NOTHING;

WITH role_permissions(role_key, permission_key) AS (
  VALUES
    ('super_admin', 'activity_logs.view'),
    ('super_admin', 'admins.sessions.manage'),
    ('super_admin', 'orders.view'),
    ('super_admin', 'orders.manage'),
    ('super_admin', 'content.manage'),
    ('super_admin', 'finance.manage'),
    ('super_admin', 'internal_settings.manage'),
    ('super_admin', 'approvals.manage'),
    ('operations_admin', 'activity_logs.view'),
    ('operations_admin', 'admins.sessions.manage'),
    ('operations_admin', 'orders.view'),
    ('operations_admin', 'orders.manage'),
    ('operations_admin', 'content.manage'),
    ('operations_admin', 'finance.manage'),
    ('operations_admin', 'internal_settings.manage'),
    ('operations_admin', 'approvals.manage'),
    ('support_admin', 'activity_logs.view'),
    ('finance_admin', 'activity_logs.view'),
    ('finance_admin', 'orders.view'),
    ('finance_admin', 'orders.manage'),
    ('finance_admin', 'finance.manage'),
    ('moderation_admin', 'activity_logs.view'),
    ('analyst', 'activity_logs.view'),
    ('analyst', 'orders.view'),
    ('admin', 'activity_logs.view'),
    ('admin', 'orders.view'),
    ('admin', 'orders.manage'),
    ('admin', 'content.manage')
)
INSERT INTO public.admin_role_permissions (role_id, permission_key)
SELECT roles.id, role_permissions.permission_key
FROM role_permissions
JOIN public.admin_roles roles ON roles.key = role_permissions.role_key
ON CONFLICT (role_id, permission_key) DO NOTHING;
