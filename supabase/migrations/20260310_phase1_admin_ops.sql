-- Phase 1 foundation for internal admin ops platform

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_account_status') THEN
    CREATE TYPE public.admin_account_status AS ENUM ('active', 'suspended', 'deactivated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_audit_category') THEN
    CREATE TYPE public.admin_audit_category AS ENUM (
      'auth',
      'admin',
      'user',
      'subscription',
      'billing',
      'support',
      'risk',
      'search',
      'export',
      'config',
      'security',
      'bulk'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_audit_severity') THEN
    CREATE TYPE public.admin_audit_severity AS ENUM ('info', 'warning', 'critical');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_note_type') THEN
    CREATE TYPE public.user_note_type AS ENUM ('general', 'support', 'finance', 'risk', 'moderation');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_flag_status') THEN
    CREATE TYPE public.user_flag_status AS ENUM ('active', 'resolved', 'dismissed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'saved_view_scope') THEN
    CREATE TYPE public.saved_view_scope AS ENUM ('users', 'admins', 'subscriptions', 'audit_logs');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_role_status') THEN
    CREATE TYPE public.admin_role_status AS ENUM ('active', 'inactive');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'internal_user_status') THEN
    CREATE TYPE public.internal_user_status AS ENUM (
      'active',
      'suspended',
      'banned',
      'flagged',
      'under_review',
      'pending_verification',
      'soft_deleted',
      'inactive'
    );
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'analyst',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admin_users
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS status public.admin_account_status NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_login_ip TEXT,
  ADD COLUMN IF NOT EXISTS last_login_user_agent TEXT,
  ADD COLUMN IF NOT EXISTS last_password_change_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS must_reauth_after TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failed_login_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_failed_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS allowed_ip_cidrs TEXT[];

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_users_email_lower
  ON public.admin_users (LOWER(email))
  WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_users_username_lower
  ON public.admin_users (LOWER(username));

DROP TRIGGER IF EXISTS set_updated_at_admin_users ON public.admin_users;
CREATE TRIGGER set_updated_at_admin_users
  BEFORE UPDATE ON public.admin_users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS status public.internal_user_status NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS auth_provider TEXT,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS country_code TEXT,
  ADD COLUMN IF NOT EXISTS region TEXT,
  ADD COLUMN IF NOT EXISTS locale TEXT,
  ADD COLUMN IF NOT EXISTS billing_status TEXT,
  ADD COLUMN IF NOT EXISTS risk_score INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS risk_status TEXT,
  ADD COLUMN IF NOT EXISTS referral_code TEXT,
  ADD COLUMN IF NOT EXISTS referred_by_code TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_status TEXT,
  ADD COLUMN IF NOT EXISTS vip_status BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_username_lower
  ON public.users (LOWER(username))
  WHERE username IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_status_created
  ON public.users (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_risk_score
  ON public.users (risk_score DESC, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_country_code
  ON public.users (country_code);

CREATE TABLE IF NOT EXISTS public.admin_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  status public.admin_role_status NOT NULL DEFAULT 'active',
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  parent_role_id UUID REFERENCES public.admin_roles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_updated_at_admin_roles ON public.admin_roles;
CREATE TRIGGER set_updated_at_admin_roles
  BEFORE UPDATE ON public.admin_roles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE IF NOT EXISTS public.admin_permissions (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.admin_role_permissions (
  role_id UUID NOT NULL REFERENCES public.admin_roles(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES public.admin_permissions(key) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (role_id, permission_key)
);

CREATE TABLE IF NOT EXISTS public.admin_user_roles (
  admin_id UUID NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.admin_roles(id) ON DELETE CASCADE,
  assigned_by_admin_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (admin_id, role_id)
);

CREATE TABLE IF NOT EXISTS public.admin_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
  token_hash TEXT,
  token TEXT,
  session_label TEXT,
  device_label TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  idle_expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  mfa_verified_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin_id
  ON public.admin_sessions (admin_id, revoked_at, expires_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_sessions_token_hash
  ON public.admin_sessions (token_hash)
  WHERE token_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.admin_login_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  identifier TEXT NOT NULL,
  success BOOLEAN NOT NULL DEFAULT FALSE,
  failure_reason TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_login_attempts_identifier
  ON public.admin_login_attempts (identifier, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_login_attempts_ip
  ON public.admin_login_attempts (ip_address, created_at DESC);

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_admin_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  actor_role TEXT,
  action_type TEXT NOT NULL,
  category public.admin_audit_category NOT NULL,
  severity public.admin_audit_severity NOT NULL DEFAULT 'info',
  target_entity_type TEXT,
  target_entity_id TEXT,
  target_summary TEXT,
  reason TEXT,
  before_state JSONB,
  after_state JSONB,
  metadata JSONB,
  request_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  approved_by_admin_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at
  ON public.admin_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_actor
  ON public.admin_audit_logs (actor_admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target
  ON public.admin_audit_logs (target_entity_type, target_entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_category
  ON public.admin_audit_logs (category, created_at DESC);

CREATE TABLE IF NOT EXISTS public.user_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  author_admin_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  note_type public.user_note_type NOT NULL DEFAULT 'general',
  body TEXT NOT NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  is_internal_only BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

DROP TRIGGER IF EXISTS set_updated_at_user_notes ON public.user_notes;
CREATE TRIGGER set_updated_at_user_notes
  BEFORE UPDATE ON public.user_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX IF NOT EXISTS idx_user_notes_user_id
  ON public.user_notes (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.user_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  color TEXT,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_tag_assignments (
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.user_tags(id) ON DELETE CASCADE,
  assigned_by_admin_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_user_tag_assignments_tag_id
  ON public.user_tag_assignments (tag_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.user_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  severity public.admin_audit_severity NOT NULL DEFAULT 'warning',
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_flag_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  flag_id UUID NOT NULL REFERENCES public.user_flags(id) ON DELETE CASCADE,
  status public.user_flag_status NOT NULL DEFAULT 'active',
  reason TEXT,
  assigned_by_admin_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  resolved_by_admin_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, flag_id, status)
);

DROP TRIGGER IF EXISTS set_updated_at_user_flag_assignments ON public.user_flag_assignments;
CREATE TRIGGER set_updated_at_user_flag_assignments
  BEFORE UPDATE ON public.user_flag_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX IF NOT EXISTS idx_user_flag_assignments_user_id
  ON public.user_flag_assignments (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.saved_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_admin_id UUID REFERENCES public.admin_users(id) ON DELETE CASCADE,
  scope public.saved_view_scope NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  columns JSONB,
  is_shared BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_updated_at_saved_views ON public.saved_views;
CREATE TRIGGER set_updated_at_saved_views
  BEFORE UPDATE ON public.saved_views
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX IF NOT EXISTS idx_saved_views_owner_scope
  ON public.saved_views (owner_admin_id, scope, updated_at DESC);

INSERT INTO public.admin_roles (key, name, description, is_system)
VALUES
  ('super_admin', 'Super Admin', 'Full system access', TRUE),
  ('operations_admin', 'Operations Admin', 'Operations control for users and subscriptions', TRUE),
  ('support_admin', 'Support Admin', 'Customer support and account assistance', TRUE),
  ('finance_admin', 'Finance Admin', 'Billing, subscriptions, and refunds', TRUE),
  ('moderation_admin', 'Moderation Admin', 'Moderation, risk, and review tooling', TRUE),
  ('analyst', 'Analyst', 'Read-only analytical access', TRUE)
ON CONFLICT (key) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_system = EXCLUDED.is_system;

INSERT INTO public.admin_permissions (key, label, description)
VALUES
  ('dashboard.view', 'View dashboard', 'Read dashboard metrics'),
  ('users.view', 'View users', 'Read user lists and profiles'),
  ('users.edit', 'Edit users', 'Update user fields'),
  ('users.suspend', 'Suspend users', 'Suspend user access'),
  ('users.ban', 'Ban users', 'Ban user access'),
  ('users.reactivate', 'Reactivate users', 'Restore user access'),
  ('users.soft_delete', 'Soft delete users', 'Soft delete users'),
  ('users.sessions.manage', 'Manage user sessions', 'Revoke user sessions'),
  ('users.impersonate', 'Impersonate users', 'Impersonate a user session'),
  ('users.export', 'Export users', 'Export user data'),
  ('subscriptions.view', 'View subscriptions', 'Read subscription data'),
  ('subscriptions.manage', 'Manage subscriptions', 'Change subscription states'),
  ('billing.view', 'View billing', 'Read billing and payment data'),
  ('billing.refunds.issue', 'Issue refunds', 'Issue refunds and finance exceptions'),
  ('finance.notes.manage', 'Manage finance notes', 'Add finance notes'),
  ('support.view', 'View support data', 'Read support context'),
  ('support.notes.manage', 'Manage support notes', 'Add internal support notes'),
  ('tags.manage', 'Manage tags', 'Assign and remove user tags'),
  ('flags.manage', 'Manage flags', 'Assign and resolve user flags'),
  ('risk.view', 'View risk', 'Read risk signals'),
  ('risk.manage', 'Manage risk', 'Update risk decisions'),
  ('reviews.manage', 'Manage reviews', 'Manage review queue and decisions'),
  ('audit_logs.view', 'View audit logs', 'Read admin audit logs'),
  ('admins.view', 'View admins', 'Read admin list and profiles'),
  ('admins.create', 'Create admins', 'Create new admin users'),
  ('admins.edit', 'Edit admins', 'Update admin profile/roles'),
  ('admins.deactivate', 'Deactivate admins', 'Deactivate or revoke admin access'),
  ('roles.assign', 'Assign roles', 'Assign admin roles'),
  ('permissions.manage', 'Manage permissions', 'Manage custom permissions'),
  ('saved_views.manage', 'Manage saved views', 'Create and edit saved filters'),
  ('bulk_actions.run', 'Run bulk actions', 'Execute bulk operational actions'),
  ('feature_flags.manage', 'Manage feature flags', 'Update feature flags'),
  ('settings.manage', 'Manage settings', 'Update internal settings'),
  ('exports.run', 'Run exports', 'Export sensitive operational data')
ON CONFLICT (key) DO NOTHING;

WITH role_permissions(role_key, permission_key) AS (
  VALUES
    ('super_admin', 'dashboard.view'),
    ('super_admin', 'users.view'),
    ('super_admin', 'users.edit'),
    ('super_admin', 'users.suspend'),
    ('super_admin', 'users.ban'),
    ('super_admin', 'users.reactivate'),
    ('super_admin', 'users.soft_delete'),
    ('super_admin', 'users.sessions.manage'),
    ('super_admin', 'users.impersonate'),
    ('super_admin', 'users.export'),
    ('super_admin', 'subscriptions.view'),
    ('super_admin', 'subscriptions.manage'),
    ('super_admin', 'billing.view'),
    ('super_admin', 'billing.refunds.issue'),
    ('super_admin', 'finance.notes.manage'),
    ('super_admin', 'support.view'),
    ('super_admin', 'support.notes.manage'),
    ('super_admin', 'tags.manage'),
    ('super_admin', 'flags.manage'),
    ('super_admin', 'risk.view'),
    ('super_admin', 'risk.manage'),
    ('super_admin', 'reviews.manage'),
    ('super_admin', 'audit_logs.view'),
    ('super_admin', 'admins.view'),
    ('super_admin', 'admins.create'),
    ('super_admin', 'admins.edit'),
    ('super_admin', 'admins.deactivate'),
    ('super_admin', 'roles.assign'),
    ('super_admin', 'permissions.manage'),
    ('super_admin', 'saved_views.manage'),
    ('super_admin', 'bulk_actions.run'),
    ('super_admin', 'feature_flags.manage'),
    ('super_admin', 'settings.manage'),
    ('super_admin', 'exports.run'),
    ('operations_admin', 'dashboard.view'),
    ('operations_admin', 'users.view'),
    ('operations_admin', 'users.edit'),
    ('operations_admin', 'users.suspend'),
    ('operations_admin', 'users.reactivate'),
    ('operations_admin', 'users.sessions.manage'),
    ('operations_admin', 'subscriptions.view'),
    ('operations_admin', 'subscriptions.manage'),
    ('operations_admin', 'support.view'),
    ('operations_admin', 'support.notes.manage'),
    ('operations_admin', 'tags.manage'),
    ('operations_admin', 'flags.manage'),
    ('operations_admin', 'risk.view'),
    ('operations_admin', 'reviews.manage'),
    ('operations_admin', 'audit_logs.view'),
    ('operations_admin', 'saved_views.manage'),
    ('operations_admin', 'bulk_actions.run'),
    ('operations_admin', 'settings.manage'),
    ('support_admin', 'dashboard.view'),
    ('support_admin', 'users.view'),
    ('support_admin', 'users.edit'),
    ('support_admin', 'users.sessions.manage'),
    ('support_admin', 'support.view'),
    ('support_admin', 'support.notes.manage'),
    ('support_admin', 'tags.manage'),
    ('support_admin', 'flags.manage'),
    ('support_admin', 'saved_views.manage'),
    ('finance_admin', 'dashboard.view'),
    ('finance_admin', 'users.view'),
    ('finance_admin', 'subscriptions.view'),
    ('finance_admin', 'subscriptions.manage'),
    ('finance_admin', 'billing.view'),
    ('finance_admin', 'billing.refunds.issue'),
    ('finance_admin', 'finance.notes.manage'),
    ('finance_admin', 'audit_logs.view'),
    ('finance_admin', 'exports.run'),
    ('finance_admin', 'saved_views.manage'),
    ('moderation_admin', 'dashboard.view'),
    ('moderation_admin', 'users.view'),
    ('moderation_admin', 'users.suspend'),
    ('moderation_admin', 'users.ban'),
    ('moderation_admin', 'users.reactivate'),
    ('moderation_admin', 'support.notes.manage'),
    ('moderation_admin', 'tags.manage'),
    ('moderation_admin', 'flags.manage'),
    ('moderation_admin', 'risk.view'),
    ('moderation_admin', 'risk.manage'),
    ('moderation_admin', 'reviews.manage'),
    ('moderation_admin', 'saved_views.manage'),
    ('analyst', 'dashboard.view'),
    ('analyst', 'users.view'),
    ('analyst', 'subscriptions.view'),
    ('analyst', 'billing.view'),
    ('analyst', 'support.view'),
    ('analyst', 'risk.view'),
    ('analyst', 'audit_logs.view'),
    ('analyst', 'saved_views.manage')
)
INSERT INTO public.admin_role_permissions (role_id, permission_key)
SELECT roles.id, role_permissions.permission_key
FROM role_permissions
JOIN public.admin_roles roles ON roles.key = role_permissions.role_key
ON CONFLICT (role_id, permission_key) DO NOTHING;

INSERT INTO public.admin_user_roles (admin_id, role_id)
SELECT admin_users.id, admin_roles.id
FROM public.admin_users
JOIN public.admin_roles
  ON admin_roles.key = CASE
    WHEN admin_users.role = 'super_admin' THEN 'super_admin'
    WHEN admin_users.role = 'admin' THEN 'operations_admin'
    WHEN admin_users.role = 'viewer' THEN 'analyst'
    ELSE admin_users.role
  END
ON CONFLICT (admin_id, role_id) DO NOTHING;

INSERT INTO public.user_tags (key, label, color, description, is_system)
VALUES
  ('vip', 'VIP', 'amber', 'High-value user', TRUE),
  ('high_value', 'High Value', 'green', 'High LTV user', TRUE),
  ('manual_review', 'Manual Review', 'orange', 'Needs review', TRUE),
  ('support_follow_up', 'Support Follow-up', 'blue', 'Support should follow up', TRUE),
  ('churn_risk', 'Churn Risk', 'red', 'Likely to churn', TRUE)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.user_flags (key, label, description, severity, is_system)
VALUES
  ('fraud_risk', 'Fraud Risk', 'Potential fraud or abuse', 'critical', TRUE),
  ('support_escalation', 'Support Escalation', 'Support escalation required', 'warning', TRUE),
  ('finance_review', 'Finance Review', 'Finance review needed', 'warning', TRUE),
  ('urgent_review', 'Urgent Review', 'Urgent operational review needed', 'critical', TRUE),
  ('moderation_review', 'Moderation Review', 'Moderation review required', 'warning', TRUE)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.admin_login(p_username TEXT, p_password TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  admin_record public.admin_users%ROWTYPE;
BEGIN
  SELECT *
  INTO admin_record
  FROM public.admin_users
  WHERE LOWER(username) = LOWER(TRIM(p_username))
    AND status = 'active'
    AND is_active = TRUE
  LIMIT 1;

  IF admin_record.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid admin credentials');
  END IF;

  IF admin_record.password_hash IS NULL OR crypt(p_password, admin_record.password_hash) <> admin_record.password_hash THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid admin credentials');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'admin', jsonb_build_object(
      'id', admin_record.id,
      'username', admin_record.username,
      'role', admin_record.role
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_change_password(
  p_admin_id UUID,
  p_old_password TEXT,
  p_new_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  admin_record public.admin_users%ROWTYPE;
BEGIN
  SELECT *
  INTO admin_record
  FROM public.admin_users
  WHERE id = p_admin_id
  LIMIT 1;

  IF admin_record.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin not found');
  END IF;

  IF crypt(p_old_password, admin_record.password_hash) <> admin_record.password_hash THEN
    RETURN jsonb_build_object('success', false, 'error', 'Current password is incorrect');
  END IF;

  UPDATE public.admin_users
  SET
    password_hash = crypt(p_new_password, gen_salt('bf')),
    last_password_change_at = NOW(),
    must_reauth_after = NOW()
  WHERE id = p_admin_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_username TEXT,
  p_email TEXT,
  p_display_name TEXT,
  p_password TEXT,
  p_role TEXT DEFAULT 'analyst'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO public.admin_users (
    username,
    email,
    display_name,
    password_hash,
    role,
    status,
    is_active
  )
  VALUES (
    LOWER(TRIM(p_username)),
    NULLIF(LOWER(TRIM(p_email)), ''),
    NULLIF(TRIM(p_display_name), ''),
    crypt(p_password, gen_salt('bf')),
    p_role,
    'active',
    TRUE
  )
  RETURNING id INTO new_id;

  RETURN jsonb_build_object('success', true, 'admin_id', new_id);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin username or email already exists');
END;
$$;
