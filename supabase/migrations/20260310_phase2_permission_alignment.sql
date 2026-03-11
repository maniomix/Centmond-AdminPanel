INSERT INTO public.admin_permissions (key, label, description)
VALUES
  ('finance.view', 'View finance operations', 'Read finance dashboards and event history'),
  ('exports.view', 'View export jobs', 'Read export job history and status'),
  ('exports.manage', 'Manage exports', 'Generate and download sensitive exports'),
  ('feature_flags.view', 'View feature flags', 'Read feature flag configuration'),
  ('internal_settings.view', 'View internal settings', 'Read operational settings'),
  ('user_sessions.view', 'View user sessions', 'Read user session and device inventory'),
  ('user_sessions.manage', 'Manage user sessions', 'Revoke user sessions and mark device risk'),
  ('review_queue.manage', 'Manage review queue', 'Manage review queue state and decisions'),
  ('support_handoffs.manage', 'Manage support handoffs', 'Create and manage support handoffs')
ON CONFLICT (key) DO NOTHING;

WITH permission_mappings(old_permission_key, new_permission_key) AS (
  VALUES
    ('billing.view', 'finance.view'),
    ('finance.manage', 'finance.view'),
    ('exports.run', 'exports.view'),
    ('exports.run', 'exports.manage'),
    ('feature_flags.manage', 'feature_flags.view'),
    ('internal_settings.manage', 'internal_settings.view'),
    ('users.sessions.manage', 'user_sessions.view'),
    ('users.sessions.manage', 'user_sessions.manage'),
    ('reviews.manage', 'review_queue.manage'),
    ('support.notes.manage', 'support_handoffs.manage'),
    ('finance.notes.manage', 'support_handoffs.manage')
)
INSERT INTO public.admin_role_permissions (role_id, permission_key)
SELECT DISTINCT role_permissions.role_id, permission_mappings.new_permission_key
FROM public.admin_role_permissions role_permissions
JOIN permission_mappings
  ON permission_mappings.old_permission_key = role_permissions.permission_key
ON CONFLICT (role_id, permission_key) DO NOTHING;
