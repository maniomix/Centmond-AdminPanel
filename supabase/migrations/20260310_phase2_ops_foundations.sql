DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_session_status') THEN
    CREATE TYPE public.user_session_status AS ENUM ('active', 'revoked', 'expired', 'suspicious');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'finance_event_status') THEN
    CREATE TYPE public.finance_event_status AS ENUM (
      'recorded',
      'pending_provider_action',
      'resolved',
      'cancelled'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bulk_job_status') THEN
    CREATE TYPE public.bulk_job_status AS ENUM (
      'queued',
      'processing',
      'completed',
      'partially_completed',
      'failed'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'export_job_status') THEN
    CREATE TYPE public.export_job_status AS ENUM (
      'queued',
      'processing',
      'completed',
      'failed',
      'expired'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'review_queue_status') THEN
    CREATE TYPE public.review_queue_status AS ENUM (
      'under_review',
      'escalated',
      'approved',
      'rejected',
      'restricted',
      'false_positive',
      'resolved'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'support_handoff_status') THEN
    CREATE TYPE public.support_handoff_status AS ENUM ('open', 'in_progress', 'resolved');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.user_devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  device_fingerprint TEXT NOT NULL,
  device_label TEXT,
  platform TEXT,
  os TEXT,
  browser TEXT,
  model TEXT,
  metadata JSONB,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_ip_address TEXT,
  last_country_code TEXT,
  last_region TEXT,
  is_suspicious BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, device_fingerprint)
);

DROP TRIGGER IF EXISTS set_updated_at_user_devices ON public.user_devices;
CREATE TRIGGER set_updated_at_user_devices
  BEFORE UPDATE ON public.user_devices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX IF NOT EXISTS idx_user_devices_user_last_seen
  ON public.user_devices (user_id, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  device_id UUID REFERENCES public.user_devices(id) ON DELETE SET NULL,
  session_token_hash TEXT,
  session_label TEXT,
  ip_address TEXT,
  country_code TEXT,
  region TEXT,
  user_agent TEXT,
  status public.user_session_status NOT NULL DEFAULT 'active',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  revoked_by_admin_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  require_reauth BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_status_seen
  ON public.user_sessions (user_id, status, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_device_seen
  ON public.user_sessions (device_id, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS public.finance_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  actor_admin_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  status public.finance_event_status NOT NULL DEFAULT 'recorded',
  amount INTEGER,
  currency TEXT NOT NULL DEFAULT 'EUR',
  provider TEXT,
  reference_id TEXT,
  reason TEXT,
  note TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_updated_at_finance_events ON public.finance_events;
CREATE TRIGGER set_updated_at_finance_events
  BEFORE UPDATE ON public.finance_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX IF NOT EXISTS idx_finance_events_user_created
  ON public.finance_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_finance_events_type_created
  ON public.finance_events (event_type, created_at DESC);

CREATE TABLE IF NOT EXISTS public.support_handoffs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  from_admin_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  to_admin_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  status public.support_handoff_status NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'normal',
  summary TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

DROP TRIGGER IF EXISTS set_updated_at_support_handoffs ON public.support_handoffs;
CREATE TRIGGER set_updated_at_support_handoffs
  BEFORE UPDATE ON public.support_handoffs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX IF NOT EXISTS idx_support_handoffs_user_created
  ON public.support_handoffs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_handoffs_status_updated
  ON public.support_handoffs (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.bulk_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by_admin_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  job_type TEXT NOT NULL,
  target_scope TEXT NOT NULL DEFAULT 'users',
  status public.bulk_job_status NOT NULL DEFAULT 'queued',
  reason TEXT,
  input JSONB NOT NULL,
  result JSONB,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_updated_at_bulk_jobs ON public.bulk_jobs;
CREATE TRIGGER set_updated_at_bulk_jobs
  BEFORE UPDATE ON public.bulk_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX IF NOT EXISTS idx_bulk_jobs_status_created
  ON public.bulk_jobs (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bulk_jobs_admin_created
  ON public.bulk_jobs (created_by_admin_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.export_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by_admin_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  export_type TEXT NOT NULL,
  target_scope TEXT NOT NULL,
  status public.export_job_status NOT NULL DEFAULT 'queued',
  format TEXT NOT NULL DEFAULT 'csv',
  filters JSONB,
  row_count INTEGER,
  file_name TEXT,
  reason TEXT,
  content TEXT,
  metadata JSONB,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_updated_at_export_jobs ON public.export_jobs;
CREATE TRIGGER set_updated_at_export_jobs
  BEFORE UPDATE ON public.export_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX IF NOT EXISTS idx_export_jobs_status_created
  ON public.export_jobs (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_export_jobs_admin_created
  ON public.export_jobs (created_by_admin_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.feature_flags (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  rollout_percentage INTEGER NOT NULL DEFAULT 100,
  audience_filters JSONB,
  updated_by_admin_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_updated_at_feature_flags ON public.feature_flags;
CREATE TRIGGER set_updated_at_feature_flags
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE IF NOT EXISTS public.internal_settings (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_sensitive BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by_admin_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_updated_at_internal_settings ON public.internal_settings;
CREATE TRIGGER set_updated_at_internal_settings
  BEFORE UPDATE ON public.internal_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE IF NOT EXISTS public.review_queue_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  status public.review_queue_status NOT NULL DEFAULT 'under_review',
  priority TEXT NOT NULL DEFAULT 'normal',
  source TEXT,
  created_by_admin_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  assigned_to_admin_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  last_decided_by_admin_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  risk_score_snapshot INTEGER,
  latest_reason TEXT,
  metadata JSONB,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_decided_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_updated_at_review_queue_items ON public.review_queue_items;
CREATE TRIGGER set_updated_at_review_queue_items
  BEFORE UPDATE ON public.review_queue_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX IF NOT EXISTS idx_review_queue_status_updated
  ON public.review_queue_items (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_queue_assignee_updated
  ON public.review_queue_items (assigned_to_admin_id, updated_at DESC);

INSERT INTO public.review_queue_items (
  user_id,
  status,
  priority,
  source,
  risk_score_snapshot,
  latest_reason,
  opened_at
)
SELECT
  users.id,
  CASE
    WHEN users.status = 'banned' THEN 'restricted'::public.review_queue_status
    ELSE 'under_review'::public.review_queue_status
  END,
  CASE
    WHEN COALESCE(users.risk_score, 0) >= 80 THEN 'high'
    ELSE 'normal'
  END,
  'phase2_backfill',
  COALESCE(users.risk_score, 0),
  CONCAT('Backfilled from user status ', users.status),
  NOW()
FROM public.users
WHERE users.status IN ('under_review', 'flagged', 'banned')
ON CONFLICT (user_id) DO NOTHING;
