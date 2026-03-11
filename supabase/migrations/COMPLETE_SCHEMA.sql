-- ==========================================
-- CENTMOND APP + ADMIN PANEL — COMPLETE SCHEMA
-- نسخه نهایی v3 — ترتیب صحیح: index بعد از ستون‌ها
-- ==========================================

begin;

-- ==========================================
-- EXTENSIONS
-- ==========================================

create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

-- ==========================================
-- ENUMS
-- ==========================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'admin_account_status') then
    create type public.admin_account_status as enum ('active','suspended','deactivated');
  end if;
  if not exists (select 1 from pg_type where typname = 'admin_audit_category') then
    create type public.admin_audit_category as enum (
      'auth','admin','user','subscription','billing',
      'support','risk','search','export','config','security','bulk'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'admin_audit_severity') then
    create type public.admin_audit_severity as enum ('info','warning','critical');
  end if;
  if not exists (select 1 from pg_type where typname = 'admin_role_status') then
    create type public.admin_role_status as enum ('active','inactive');
  end if;
  if not exists (select 1 from pg_type where typname = 'internal_user_status') then
    create type public.internal_user_status as enum (
      'active','suspended','banned','flagged',
      'under_review','pending_verification','soft_deleted','inactive'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'user_note_type') then
    create type public.user_note_type as enum ('general','support','finance','risk','moderation');
  end if;
  if not exists (select 1 from pg_type where typname = 'user_flag_status') then
    create type public.user_flag_status as enum ('active','resolved','dismissed');
  end if;
  if not exists (select 1 from pg_type where typname = 'saved_view_scope') then
    create type public.saved_view_scope as enum ('users','admins','subscriptions','audit_logs');
  end if;
  if not exists (select 1 from pg_type where typname = 'user_session_status') then
    create type public.user_session_status as enum ('active','revoked','expired','suspicious');
  end if;
  if not exists (select 1 from pg_type where typname = 'finance_event_status') then
    create type public.finance_event_status as enum (
      'recorded','pending_provider_action','resolved','cancelled'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'bulk_job_status') then
    create type public.bulk_job_status as enum (
      'queued','processing','completed','partially_completed','failed'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'export_job_status') then
    create type public.export_job_status as enum (
      'queued','processing','completed','failed','expired'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'review_queue_status') then
    create type public.review_queue_status as enum (
      'under_review','escalated','approved','rejected',
      'restricted','false_positive','resolved'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'support_handoff_status') then
    create type public.support_handoff_status as enum ('open','in_progress','resolved');
  end if;
end $$;

-- ==========================================
-- TRIGGER FUNCTIONS
-- ==========================================

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create or replace function public.update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- ==========================================
-- PART A: CENTMOND APP TABLES
-- ==========================================

-- 1. users
create table if not exists public.users (
  id                uuid primary key references auth.users(id) on delete cascade,
  email             text,
  display_name      text,
  profile_image     text,
  custom_categories jsonb not null default '[]'::jsonb,
  created_at        timestamptz not null default now(),
  last_active_at    timestamptz,
  updated_at        timestamptz not null default now(),
  phone             text,
  phone_verified    boolean not null default false,
  username          text,
  full_name         text,
  auth_provider     text,
  last_login_at     timestamptz,
  country_code      text,
  region            text,
  locale            text,
  billing_status    text,
  risk_score        integer not null default 0,
  risk_status       text,
  referral_code     text,
  referred_by_code  text,
  onboarding_status text,
  vip_status        boolean not null default false,
  deleted_at        timestamptz,
  is_email_verified boolean not null default false,
  profile_image_url text
);

-- users.status — enum, داخل do
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='users' and column_name='status'
  ) then
    alter table public.users add column status public.internal_user_status not null default 'active';
  end if;
end $$;

-- 2. transactions
create table if not exists public.transactions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  amount     integer not null default 0,
  category   text not null default 'other',
  type       text not null default 'expense',
  note       text,
  date       text not null default to_char(current_date, 'YYYY-MM-DD'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. budgets
create table if not exists public.budgets (
  id           bigint generated by default as identity primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  month        text not null,
  total_amount integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- 4. category_budgets
create table if not exists public.category_budgets (
  id         bigint generated by default as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  month      text not null,
  category   text not null,
  amount     integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5. events
create table if not exists public.events (
  id               bigint generated by default as identity primary key,
  user_id          uuid references auth.users(id) on delete set null,
  event_name       text not null,
  event_properties jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);

-- 6. app_state
create table if not exists public.app_state (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 7. recurring_transactions
create table if not exists public.recurring_transactions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  name                text not null,
  amount              integer not null default 0,
  category            text not null default 'other',
  frequency           text not null default 'monthly',
  start_date          text not null default to_char(current_date, 'YYYY-MM-DD'),
  end_date            text,
  is_active           boolean not null default true,
  last_processed_date text,
  payment_method      text not null default 'card',
  note                text not null default '',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- 8. subscriptions
create table if not exists public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade,
  status                 text not null default 'free',
  plan                   text not null default 'free',
  platform               text,
  trial_start            timestamptz,
  trial_end              timestamptz,
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  apple_transaction_id   text,
  stripe_subscription_id text,
  stripe_customer_id     text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint subscriptions_user_id_unique unique (user_id)
);

-- ==========================================
-- PART B: ADMIN USERS
-- ==========================================

-- 9. admin_users — ستون‌های معمولی در CREATE TABLE
create table if not exists public.admin_users (
  id                      uuid primary key default gen_random_uuid(),
  username                text not null unique,
  password_hash           text not null,
  display_name            text,
  email                   text,
  role                    text not null default 'analyst',
  is_active               boolean not null default true,
  mfa_enabled             boolean not null default false,
  last_login_at           timestamptz,
  last_login_ip           text,
  last_login_user_agent   text,
  last_password_change_at timestamptz not null default now(),
  must_reauth_after       timestamptz,
  failed_login_count      integer not null default 0,
  last_failed_login_at    timestamptz,
  allowed_ip_cidrs        text[],
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- admin_users.status — enum, داخل do
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='admin_users' and column_name='status'
  ) then
    alter table public.admin_users add column status public.admin_account_status not null default 'active';
  end if;
end $$;

-- سایر ستون‌های admin_users که ممکنه در نسخه قدیمی نباشن
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='admin_users' and column_name='email') then
    alter table public.admin_users add column email text; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='admin_users' and column_name='mfa_enabled') then
    alter table public.admin_users add column mfa_enabled boolean not null default false; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='admin_users' and column_name='last_login_ip') then
    alter table public.admin_users add column last_login_ip text; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='admin_users' and column_name='last_login_user_agent') then
    alter table public.admin_users add column last_login_user_agent text; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='admin_users' and column_name='last_password_change_at') then
    alter table public.admin_users add column last_password_change_at timestamptz not null default now(); end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='admin_users' and column_name='must_reauth_after') then
    alter table public.admin_users add column must_reauth_after timestamptz; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='admin_users' and column_name='failed_login_count') then
    alter table public.admin_users add column failed_login_count integer not null default 0; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='admin_users' and column_name='last_failed_login_at') then
    alter table public.admin_users add column last_failed_login_at timestamptz; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='admin_users' and column_name='allowed_ip_cidrs') then
    alter table public.admin_users add column allowed_ip_cidrs text[]; end if;
end $$;

-- ✅ index های admin_users — بعد از تضمین وجود ستون‌ها
create unique index if not exists idx_admin_users_username_lower on public.admin_users (lower(username));
create unique index if not exists idx_admin_users_email_lower on public.admin_users (lower(email)) where email is not null;

-- ==========================================
-- 10. admin_sessions — فقط ستون‌های اجباری در CREATE TABLE
-- ==========================================

create table if not exists public.admin_sessions (
  id         uuid primary key default gen_random_uuid(),
  admin_id   uuid not null references public.admin_users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- ✅ اول همه ستون‌ها رو اضافه کن، بعد index بساز
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='admin_sessions' and column_name='token') then
    alter table public.admin_sessions add column token text; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='admin_sessions' and column_name='token_hash') then
    alter table public.admin_sessions add column token_hash text; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='admin_sessions' and column_name='session_label') then
    alter table public.admin_sessions add column session_label text; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='admin_sessions' and column_name='device_label') then
    alter table public.admin_sessions add column device_label text; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='admin_sessions' and column_name='ip_address') then
    alter table public.admin_sessions add column ip_address text; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='admin_sessions' and column_name='user_agent') then
    alter table public.admin_sessions add column user_agent text; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='admin_sessions' and column_name='last_seen_at') then
    alter table public.admin_sessions add column last_seen_at timestamptz not null default now(); end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='admin_sessions' and column_name='idle_expires_at') then
    alter table public.admin_sessions add column idle_expires_at timestamptz not null default (now() + interval '2 hours'); end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='admin_sessions' and column_name='revoked_at') then
    alter table public.admin_sessions add column revoked_at timestamptz; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='admin_sessions' and column_name='revoked_reason') then
    alter table public.admin_sessions add column revoked_reason text; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='admin_sessions' and column_name='mfa_verified_at') then
    alter table public.admin_sessions add column mfa_verified_at timestamptz; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='admin_sessions' and column_name='last_sensitive_auth_at') then
    alter table public.admin_sessions add column last_sensitive_auth_at timestamptz; end if;
end $$;

-- ✅ حالا index بساز — ستون‌ها وجود دارن
create unique index if not exists admin_sessions_token_unique
  on public.admin_sessions (token) where token is not null;
create unique index if not exists idx_admin_sessions_token_hash
  on public.admin_sessions (token_hash) where token_hash is not null;
create index if not exists idx_admin_sessions_admin_id
  on public.admin_sessions (admin_id, revoked_at, expires_at desc);
create index if not exists idx_admin_sessions_expires
  on public.admin_sessions (expires_at);

-- ==========================================
-- PART C: ADMIN ROLES & PERMISSIONS
-- ==========================================

-- 11. admin_roles
create table if not exists public.admin_roles (
  id             uuid primary key default gen_random_uuid(),
  key            text not null unique,
  name           text not null,
  description    text,
  status         public.admin_role_status not null default 'active',
  is_system      boolean not null default false,
  parent_role_id uuid references public.admin_roles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- 12. admin_permissions
create table if not exists public.admin_permissions (
  key         text primary key,
  label       text not null,
  description text,
  created_at  timestamptz not null default now()
);

-- 13. admin_role_permissions
create table if not exists public.admin_role_permissions (
  role_id        uuid not null references public.admin_roles(id) on delete cascade,
  permission_key text not null references public.admin_permissions(key) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (role_id, permission_key)
);

-- 14. admin_user_roles
create table if not exists public.admin_user_roles (
  admin_id             uuid not null references public.admin_users(id) on delete cascade,
  role_id              uuid not null references public.admin_roles(id) on delete cascade,
  assigned_by_admin_id uuid references public.admin_users(id) on delete set null,
  created_at           timestamptz not null default now(),
  primary key (admin_id, role_id)
);

-- ==========================================
-- PART D: ADMIN LOGIN & AUDIT
-- ==========================================

-- 15. admin_login_attempts
create table if not exists public.admin_login_attempts (
  id             uuid primary key default gen_random_uuid(),
  admin_id       uuid references public.admin_users(id) on delete set null,
  identifier     text not null,
  success        boolean not null default false,
  failure_reason text,
  ip_address     text,
  user_agent     text,
  created_at     timestamptz not null default now()
);

create index if not exists idx_admin_login_attempts_identifier on public.admin_login_attempts (identifier, created_at desc);
create index if not exists idx_admin_login_attempts_ip on public.admin_login_attempts (ip_address, created_at desc);

-- 16. admin_audit_logs
create table if not exists public.admin_audit_logs (
  id                   uuid primary key default gen_random_uuid(),
  actor_admin_id       uuid references public.admin_users(id) on delete set null,
  actor_role           text,
  action_type          text not null,
  category             public.admin_audit_category not null,
  severity             public.admin_audit_severity not null default 'info',
  target_entity_type   text,
  target_entity_id     text,
  target_summary       text,
  reason               text,
  before_state         jsonb,
  after_state          jsonb,
  metadata             jsonb,
  request_id           text,
  ip_address           text,
  user_agent           text,
  approved_by_admin_id uuid references public.admin_users(id) on delete set null,
  approved_at          timestamptz,
  created_at           timestamptz not null default now()
);

create index if not exists idx_admin_audit_logs_created_at on public.admin_audit_logs (created_at desc);
create index if not exists idx_admin_audit_logs_actor on public.admin_audit_logs (actor_admin_id, created_at desc);
create index if not exists idx_admin_audit_logs_target on public.admin_audit_logs (target_entity_type, target_entity_id, created_at desc);
create index if not exists idx_admin_audit_logs_category on public.admin_audit_logs (category, created_at desc);
create index if not exists idx_admin_audit_logs_request_id on public.admin_audit_logs (request_id);

-- ==========================================
-- PART E: USER NOTES, TAGS, FLAGS, SAVED VIEWS
-- ==========================================

-- 17. user_notes
create table if not exists public.user_notes (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users(id) on delete cascade,
  author_admin_id  uuid references public.admin_users(id) on delete set null,
  note_type        public.user_note_type not null default 'general',
  body             text not null,
  is_pinned        boolean not null default false,
  is_internal_only boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

create index if not exists idx_user_notes_user_id on public.user_notes (user_id, created_at desc);

-- 18. user_tags
create table if not exists public.user_tags (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  label       text not null,
  color       text,
  description text,
  is_system   boolean not null default false,
  created_at  timestamptz not null default now()
);

-- 19. user_tag_assignments
create table if not exists public.user_tag_assignments (
  user_id              uuid not null references public.users(id) on delete cascade,
  tag_id               uuid not null references public.user_tags(id) on delete cascade,
  assigned_by_admin_id uuid references public.admin_users(id) on delete set null,
  created_at           timestamptz not null default now(),
  primary key (user_id, tag_id)
);

create index if not exists idx_user_tag_assignments_tag_id on public.user_tag_assignments (tag_id, created_at desc);

-- 20. user_flags
create table if not exists public.user_flags (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  label       text not null,
  description text,
  severity    public.admin_audit_severity not null default 'warning',
  is_system   boolean not null default false,
  created_at  timestamptz not null default now()
);

-- 21. user_flag_assignments
create table if not exists public.user_flag_assignments (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.users(id) on delete cascade,
  flag_id              uuid not null references public.user_flags(id) on delete cascade,
  status               public.user_flag_status not null default 'active',
  reason               text,
  assigned_by_admin_id uuid references public.admin_users(id) on delete set null,
  resolved_by_admin_id uuid references public.admin_users(id) on delete set null,
  resolved_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (user_id, flag_id, status)
);

create index if not exists idx_user_flag_assignments_user_id on public.user_flag_assignments (user_id, created_at desc);

-- 22. saved_views
create table if not exists public.saved_views (
  id             uuid primary key default gen_random_uuid(),
  owner_admin_id uuid references public.admin_users(id) on delete cascade,
  scope          public.saved_view_scope not null,
  name           text not null,
  description    text,
  filters        jsonb not null default '{}'::jsonb,
  columns        jsonb,
  is_shared      boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_saved_views_owner_scope on public.saved_views (owner_admin_id, scope, updated_at desc);

-- ==========================================
-- PART F: PHASE 2 — OPERATIONAL TABLES
-- ==========================================

-- 23. user_devices
create table if not exists public.user_devices (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.users(id) on delete cascade,
  device_fingerprint text not null,
  device_label       text,
  platform           text,
  os                 text,
  browser            text,
  model              text,
  metadata           jsonb,
  first_seen_at      timestamptz not null default now(),
  last_seen_at       timestamptz not null default now(),
  last_ip_address    text,
  last_country_code  text,
  last_region        text,
  is_suspicious      boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (user_id, device_fingerprint)
);

create index if not exists idx_user_devices_user_last_seen on public.user_devices (user_id, last_seen_at desc);

-- 24. user_sessions
create table if not exists public.user_sessions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.users(id) on delete cascade,
  device_id           uuid references public.user_devices(id) on delete set null,
  session_token_hash  text,
  session_label       text,
  ip_address          text,
  country_code        text,
  region              text,
  user_agent          text,
  status              public.user_session_status not null default 'active',
  started_at          timestamptz not null default now(),
  last_seen_at        timestamptz not null default now(),
  expires_at          timestamptz,
  ended_at            timestamptz,
  revoked_at          timestamptz,
  revoked_reason      text,
  revoked_by_admin_id uuid references public.admin_users(id) on delete set null,
  require_reauth      boolean not null default false,
  metadata            jsonb,
  created_at          timestamptz not null default now()
);

create index if not exists idx_user_sessions_user_status_seen on public.user_sessions (user_id, status, last_seen_at desc);
create index if not exists idx_user_sessions_device_seen on public.user_sessions (device_id, last_seen_at desc);

-- 25. finance_events
create table if not exists public.finance_events (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references public.users(id) on delete set null,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  transaction_id  uuid references public.transactions(id) on delete set null,
  actor_admin_id  uuid references public.admin_users(id) on delete set null,
  event_type      text not null,
  status          public.finance_event_status not null default 'recorded',
  amount          integer,
  currency        text not null default 'EUR',
  provider        text,
  reference_id    text,
  reason          text,
  note            text,
  metadata        jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_finance_events_user_created on public.finance_events (user_id, created_at desc);
create index if not exists idx_finance_events_type_created on public.finance_events (event_type, created_at desc);

-- 26. support_handoffs
create table if not exists public.support_handoffs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  from_admin_id uuid references public.admin_users(id) on delete set null,
  to_admin_id   uuid references public.admin_users(id) on delete set null,
  status        public.support_handoff_status not null default 'open',
  priority      text not null default 'normal',
  summary       text not null,
  details       text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  resolved_at   timestamptz
);

create index if not exists idx_support_handoffs_user_created on public.support_handoffs (user_id, created_at desc);
create index if not exists idx_support_handoffs_status_updated on public.support_handoffs (status, updated_at desc);

-- 27. bulk_jobs
create table if not exists public.bulk_jobs (
  id                  uuid primary key default gen_random_uuid(),
  created_by_admin_id uuid references public.admin_users(id) on delete set null,
  job_type            text not null,
  target_scope        text not null default 'users',
  status              public.bulk_job_status not null default 'queued',
  reason              text,
  input               jsonb not null,
  result              jsonb,
  error_message       text,
  started_at          timestamptz,
  completed_at        timestamptz,
  failed_at           timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_bulk_jobs_status_created on public.bulk_jobs (status, created_at desc);
create index if not exists idx_bulk_jobs_admin_created on public.bulk_jobs (created_by_admin_id, created_at desc);

-- 28. export_jobs
create table if not exists public.export_jobs (
  id                  uuid primary key default gen_random_uuid(),
  created_by_admin_id uuid references public.admin_users(id) on delete set null,
  export_type         text not null,
  target_scope        text not null,
  status              public.export_job_status not null default 'queued',
  format              text not null default 'csv',
  filters             jsonb,
  row_count           integer,
  file_name           text,
  reason              text,
  content             text,
  metadata            jsonb,
  error_message       text,
  started_at          timestamptz,
  completed_at        timestamptz,
  failed_at           timestamptz,
  expires_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_export_jobs_status_created on public.export_jobs (status, created_at desc);
create index if not exists idx_export_jobs_admin_created on public.export_jobs (created_by_admin_id, created_at desc);

-- 29. feature_flags
create table if not exists public.feature_flags (
  key                 text primary key,
  label               text not null,
  description         text,
  enabled             boolean not null default false,
  rollout_percentage  integer not null default 100,
  audience_filters    jsonb,
  updated_by_admin_id uuid references public.admin_users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- 30. internal_settings
create table if not exists public.internal_settings (
  key                 text primary key,
  label               text not null,
  description         text,
  value               jsonb not null default '{}'::jsonb,
  is_sensitive        boolean not null default false,
  updated_by_admin_id uuid references public.admin_users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- 31. review_queue_items
create table if not exists public.review_queue_items (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null unique references public.users(id) on delete cascade,
  status                   public.review_queue_status not null default 'under_review',
  priority                 text not null default 'normal',
  source                   text,
  created_by_admin_id      uuid references public.admin_users(id) on delete set null,
  assigned_to_admin_id     uuid references public.admin_users(id) on delete set null,
  last_decided_by_admin_id uuid references public.admin_users(id) on delete set null,
  risk_score_snapshot      integer,
  latest_reason            text,
  metadata                 jsonb,
  opened_at                timestamptz not null default now(),
  last_decided_at          timestamptz,
  resolved_at              timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists idx_review_queue_status_updated on public.review_queue_items (status, updated_at desc);
create index if not exists idx_review_queue_assignee_updated on public.review_queue_items (assigned_to_admin_id, updated_at desc);

-- ==========================================
-- INDEXES (Balance App)
-- ==========================================

create unique index if not exists budgets_user_month_uidx on public.budgets (user_id, month);
create unique index if not exists category_budgets_user_month_category_uidx on public.category_budgets (user_id, month, category);
create index if not exists transactions_user_date_idx on public.transactions (user_id, date);
create index if not exists transactions_user_date_desc on public.transactions (user_id, date desc);
create index if not exists budgets_user_month_idx on public.budgets (user_id, month);
create index if not exists category_budgets_user_month_idx on public.category_budgets (user_id, month);
create index if not exists events_created_at_idx on public.events (created_at desc);
create index if not exists events_user_id_idx on public.events (user_id);
create index if not exists events_user_created_at_desc on public.events (user_id, created_at desc);
create index if not exists app_state_updated_at_idx on public.app_state (updated_at desc);
create index if not exists recurring_transactions_user_id_idx on public.recurring_transactions (user_id);
create index if not exists recurring_transactions_user_active_idx on public.recurring_transactions (user_id, is_active);
create index if not exists subscriptions_user_id_idx on public.subscriptions (user_id);
create index if not exists subscriptions_status_idx on public.subscriptions (status);
create index if not exists subscriptions_trial_end_idx on public.subscriptions (trial_end) where status = 'trial';
create index if not exists subscriptions_period_end_idx on public.subscriptions (current_period_end) where status = 'active';
create index if not exists subscriptions_user_updated_at_desc on public.subscriptions (user_id, updated_at desc);
create index if not exists idx_users_username_lower on public.users (lower(username)) where username is not null;
create index if not exists idx_users_status_created on public.users (status, created_at desc);
create index if not exists idx_users_risk_score on public.users (risk_score desc, updated_at desc);
create index if not exists idx_users_country_code on public.users (country_code);

-- ==========================================
-- TRIGGERS
-- ==========================================

drop trigger if exists trg_transactions_updated_at on public.transactions;
create trigger trg_transactions_updated_at before update on public.transactions for each row execute function public.set_updated_at();
drop trigger if exists trg_budgets_updated_at on public.budgets;
create trigger trg_budgets_updated_at before update on public.budgets for each row execute function public.set_updated_at();
drop trigger if exists trg_category_budgets_updated_at on public.category_budgets;
create trigger trg_category_budgets_updated_at before update on public.category_budgets for each row execute function public.set_updated_at();
drop trigger if exists trg_app_state_updated_at on public.app_state;
create trigger trg_app_state_updated_at before update on public.app_state for each row execute function public.set_updated_at();
drop trigger if exists trg_recurring_transactions_updated_at on public.recurring_transactions;
create trigger trg_recurring_transactions_updated_at before update on public.recurring_transactions for each row execute function public.set_updated_at();
drop trigger if exists trg_subscriptions_updated_at on public.subscriptions;
create trigger trg_subscriptions_updated_at before update on public.subscriptions for each row execute function public.set_updated_at();
drop trigger if exists trg_users_updated_at on public.users;
create trigger trg_users_updated_at before update on public.users for each row execute function public.set_updated_at();
drop trigger if exists trg_admin_users_updated_at on public.admin_users;
create trigger trg_admin_users_updated_at before update on public.admin_users for each row execute function public.set_updated_at();
drop trigger if exists trg_admin_roles_updated_at on public.admin_roles;
create trigger trg_admin_roles_updated_at before update on public.admin_roles for each row execute function public.set_updated_at();
drop trigger if exists trg_user_notes_updated_at on public.user_notes;
create trigger trg_user_notes_updated_at before update on public.user_notes for each row execute function public.set_updated_at();
drop trigger if exists trg_user_flag_assignments_updated_at on public.user_flag_assignments;
create trigger trg_user_flag_assignments_updated_at before update on public.user_flag_assignments for each row execute function public.set_updated_at();
drop trigger if exists trg_saved_views_updated_at on public.saved_views;
create trigger trg_saved_views_updated_at before update on public.saved_views for each row execute function public.set_updated_at();
drop trigger if exists trg_user_devices_updated_at on public.user_devices;
create trigger trg_user_devices_updated_at before update on public.user_devices for each row execute function public.set_updated_at();
drop trigger if exists trg_finance_events_updated_at on public.finance_events;
create trigger trg_finance_events_updated_at before update on public.finance_events for each row execute function public.set_updated_at();
drop trigger if exists trg_support_handoffs_updated_at on public.support_handoffs;
create trigger trg_support_handoffs_updated_at before update on public.support_handoffs for each row execute function public.set_updated_at();
drop trigger if exists trg_bulk_jobs_updated_at on public.bulk_jobs;
create trigger trg_bulk_jobs_updated_at before update on public.bulk_jobs for each row execute function public.set_updated_at();
drop trigger if exists trg_export_jobs_updated_at on public.export_jobs;
create trigger trg_export_jobs_updated_at before update on public.export_jobs for each row execute function public.set_updated_at();
drop trigger if exists trg_feature_flags_updated_at on public.feature_flags;
create trigger trg_feature_flags_updated_at before update on public.feature_flags for each row execute function public.set_updated_at();
drop trigger if exists trg_internal_settings_updated_at on public.internal_settings;
create trigger trg_internal_settings_updated_at before update on public.internal_settings for each row execute function public.set_updated_at();
drop trigger if exists trg_review_queue_items_updated_at on public.review_queue_items;
create trigger trg_review_queue_items_updated_at before update on public.review_queue_items for each row execute function public.set_updated_at();

-- ==========================================
-- CONSTRAINTS
-- ==========================================

do $$ begin
  if not exists (select 1 from pg_constraint where conrelid='public.transactions'::regclass and conname='transactions_type_check') then
    alter table public.transactions add constraint transactions_type_check check (type in ('income','expense')); end if;
  if not exists (select 1 from pg_constraint where conrelid='public.budgets'::regclass and conname='budgets_month_format_check') then
    alter table public.budgets add constraint budgets_month_format_check check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'); end if;
  if not exists (select 1 from pg_constraint where conrelid='public.category_budgets'::regclass and conname='category_budgets_month_format_check') then
    alter table public.category_budgets add constraint category_budgets_month_format_check check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'); end if;
  if not exists (select 1 from pg_constraint where conrelid='public.recurring_transactions'::regclass and conname='recurring_transactions_frequency_check') then
    alter table public.recurring_transactions add constraint recurring_transactions_frequency_check check (frequency in ('daily','weekly','monthly','yearly')); end if;
end $$;

update public.subscriptions set status='free' where status not in ('free','trial','active','expired','canceled');
update public.subscriptions set plan='free' where plan not in ('free','monthly','yearly');
update public.subscriptions set platform=null where platform is not null and platform not in ('ios','web');

alter table public.subscriptions drop constraint if exists subscriptions_status_check;
alter table public.subscriptions drop constraint if exists subscriptions_plan_check;
alter table public.subscriptions drop constraint if exists subscriptions_platform_check;
alter table public.subscriptions
  add constraint subscriptions_status_check check (status in ('free','trial','active','expired','canceled')),
  add constraint subscriptions_plan_check check (plan in ('free','monthly','yearly')),
  add constraint subscriptions_platform_check check (platform is null or platform in ('ios','web'));

-- ==========================================
-- HELPER FUNCTIONS (Balance App)
-- ==========================================

drop function if exists public.custom_slug(text);
create or replace function public.custom_slug(input text)
returns text language sql immutable as $$
  select regexp_replace(
    regexp_replace(lower(trim(coalesce(input,''))), '[^a-z0-9]+', '-', 'g'),
    '(^-+|-+$)', '', 'g');
$$;

drop function if exists public.custom_categories_to_array(jsonb);
create or replace function public.custom_categories_to_array(input jsonb)
returns jsonb language plpgsql immutable as $$
declare txt text; parsed jsonb;
begin
  if input is null then return '[]'::jsonb; end if;
  if jsonb_typeof(input) = 'array' then return input; end if;
  if jsonb_typeof(input) = 'string' then
    txt := trim(both from (input #>> '{}'));
    if txt = '' then return '[]'::jsonb; end if;
    begin
      parsed := txt::jsonb;
      if jsonb_typeof(parsed) = 'array' then return parsed; end if;
      return '[]'::jsonb;
    exception when others then return '[]'::jsonb; end;
  end if;
  return '[]'::jsonb;
end; $$;

drop function if exists public.custom_key_canonical(jsonb);
create or replace function public.custom_key_canonical(elem jsonb)
returns text language plpgsql immutable as $$
declare raw_key text; raw_name text; s text;
begin
  raw_key  := coalesce(elem->>'remote_key', elem->>'remoteKey', elem->>'key');
  raw_name := trim(coalesce(elem->>'name', ''));
  if raw_key is not null and trim(raw_key) <> '' then
    raw_key := lower(trim(raw_key));
    if raw_key like 'custom:%' then
      s := public.custom_slug(substr(raw_key, 8));
      if s <> '' then return 'custom:' || s; end if;
      return raw_key;
    end if;
    s := public.custom_slug(raw_key);
    if s <> '' then return 'custom:' || s; end if;
    return 'custom:' || raw_key;
  end if;
  if raw_name <> '' then
    s := public.custom_slug(raw_name);
    if s <> '' then return 'custom:' || s; end if;
    return lower('custom:' || raw_name);
  end if;
  return null;
end; $$;

drop function if exists public.custom_key_raw_name(jsonb);
create or replace function public.custom_key_raw_name(elem jsonb)
returns text language plpgsql immutable as $$
declare raw_name text;
begin
  raw_name := trim(coalesce(elem->>'name', ''));
  if raw_name = '' then return null; end if;
  return lower('custom:' || raw_name);
end; $$;

-- ==========================================
-- SUBSCRIPTION FUNCTIONS
-- ==========================================

create or replace function public.is_user_premium(p_user_id uuid)
returns boolean language plpgsql security definer as $$
declare sub_record record;
begin
  select status, trial_end, current_period_end into sub_record
  from public.subscriptions where user_id = p_user_id limit 1;
  if not found then return false; end if;
  if sub_record.status = 'active' then
    if sub_record.current_period_end is not null and sub_record.current_period_end < now() then
      update public.subscriptions set status='expired', updated_at=now() where user_id=p_user_id and status='active';
      return false;
    end if;
    return true;
  end if;
  if sub_record.status = 'trial' then
    if sub_record.trial_end is not null and sub_record.trial_end < now() then
      update public.subscriptions set status='expired', updated_at=now() where user_id=p_user_id and status='trial';
      return false;
    end if;
    return true;
  end if;
  return false;
end; $$;

create or replace function public.get_subscription_info(p_user_id uuid)
returns json language plpgsql security definer as $$
declare sub_record record; is_pro boolean; days_remaining integer;
begin
  select * into sub_record from public.subscriptions where user_id=p_user_id limit 1;
  if not found then
    return json_build_object('status','free','plan','free','is_pro',false,'trial_days_remaining',0);
  end if;
  is_pro := public.is_user_premium(p_user_id);
  days_remaining := 0;
  if sub_record.status='trial' and sub_record.trial_end is not null then
    days_remaining := greatest(0, extract(day from (sub_record.trial_end - now()))::integer);
  end if;
  return json_build_object(
    'status',sub_record.status,'plan',sub_record.plan,'platform',sub_record.platform,
    'is_pro',is_pro,'trial_days_remaining',days_remaining,
    'trial_start',sub_record.trial_start,'trial_end',sub_record.trial_end,
    'current_period_start',sub_record.current_period_start,
    'current_period_end',sub_record.current_period_end,'created_at',sub_record.created_at);
end; $$;

create or replace function public.start_trial(p_user_id uuid)
returns json language plpgsql security definer as $$
declare existing record; trial_end_date timestamptz;
begin
  select * into existing from public.subscriptions where user_id=p_user_id limit 1;
  if found and existing.status in ('trial','active') then
    return json_build_object('success',false,'error','User already has an active subscription or trial'); end if;
  if found and existing.trial_start is not null then
    return json_build_object('success',false,'error','Trial already used'); end if;
  trial_end_date := now() + interval '14 days';
  if found then
    update public.subscriptions set status='trial',plan='free',platform='ios',trial_start=now(),trial_end=trial_end_date,updated_at=now() where user_id=p_user_id;
  else
    insert into public.subscriptions (user_id,status,plan,platform,trial_start,trial_end)
    values (p_user_id,'trial','free','ios',now(),trial_end_date);
  end if;
  return json_build_object('success',true,'trial_end',trial_end_date,'days',14);
end; $$;

create or replace function public.handle_new_user_subscription()
returns trigger language plpgsql security definer as $$
begin
  insert into public.subscriptions (user_id,status,plan) values (new.id,'free','free')
  on conflict (user_id) do nothing;
  return new;
end; $$;

drop trigger if exists trg_new_user_subscription on public.users;
create trigger trg_new_user_subscription
  after insert on public.users
  for each row execute function public.handle_new_user_subscription();

-- ==========================================
-- ADMIN PANEL FUNCTIONS
-- ==========================================

create or replace function public.admin_login(p_username text, p_password text)
returns json language plpgsql security definer as $$
declare admin_record record; session_token text; session_expires timestamptz;
begin
  select * into admin_record from public.admin_users
  where lower(username) = lower(trim(p_username)) and is_active = true limit 1;

  if not found then
    return json_build_object('success',false,'error','Invalid username or password'); end if;
  if admin_record.status::text != 'active' then
    return json_build_object('success',false,'error','Account is not active'); end if;
  if not (admin_record.password_hash = crypt(p_password, admin_record.password_hash)) then
    return json_build_object('success',false,'error','Invalid username or password'); end if;

  session_token := encode(gen_random_bytes(48), 'hex');
  session_expires := now() + interval '24 hours';

  insert into public.admin_sessions (admin_id, token, expires_at)
  values (admin_record.id, session_token, session_expires);

  update public.admin_users set last_login_at=now() where id=admin_record.id;
  delete from public.admin_sessions where admin_id=admin_record.id and expires_at < now();

  return json_build_object(
    'success',true,'token',session_token,'expires_at',session_expires,
    'admin',json_build_object('id',admin_record.id,'username',admin_record.username,
      'display_name',admin_record.display_name,'role',admin_record.role));
end; $$;

create or replace function public.admin_validate_session(p_token text)
returns json language plpgsql security definer as $$
declare session_record record; admin_record record;
begin
  select * into session_record from public.admin_sessions
  where token=p_token and expires_at>now() and revoked_at is null limit 1;
  if not found then
    return json_build_object('valid',false,'error','Session expired or invalid'); end if;

  select * into admin_record from public.admin_users
  where id=session_record.admin_id and is_active=true limit 1;
  if not found then
    return json_build_object('valid',false,'error','Admin not found or disabled'); end if;

  update public.admin_sessions set last_seen_at=now() where id=session_record.id;

  return json_build_object(
    'valid',true,
    'admin',json_build_object('id',admin_record.id,'username',admin_record.username,
      'display_name',admin_record.display_name,'role',admin_record.role));
end; $$;

create or replace function public.admin_logout(p_token text)
returns json language plpgsql security definer as $$
begin
  delete from public.admin_sessions where token=p_token;
  return json_build_object('success',true);
end; $$;

create or replace function public.admin_create_user(
  p_admin_token text, p_username text, p_password text,
  p_display_name text default null, p_role text default 'analyst'
)
returns json language plpgsql security definer as $$
declare caller json; caller_role text; new_admin_id uuid; rid uuid;
begin
  caller := public.admin_validate_session(p_admin_token);
  if not (caller->>'valid')::boolean then
    return json_build_object('success',false,'error','Unauthorized'); end if;
  caller_role := caller->'admin'->>'role';
  if caller_role != 'super_admin' then
    return json_build_object('success',false,'error','Only super_admin can create new admins'); end if;
  if exists (select 1 from public.admin_users where lower(username)=lower(trim(p_username))) then
    return json_build_object('success',false,'error','Username already exists'); end if;

  insert into public.admin_users (username, password_hash, display_name, role, is_active)
  values (lower(trim(p_username)), crypt(p_password, gen_salt('bf',12)), p_display_name, p_role, true)
  returning id into new_admin_id;

  update public.admin_users set status='active'::public.admin_account_status where id=new_admin_id;

  select id into rid from public.admin_roles where key=p_role limit 1;
  if rid is not null then
    insert into public.admin_user_roles (admin_id,role_id) values (new_admin_id,rid)
    on conflict (admin_id,role_id) do nothing;
  end if;

  return json_build_object('success',true,'admin_id',new_admin_id,'username',lower(trim(p_username)));
end; $$;

create or replace function public.admin_change_password(
  p_admin_token text, p_old_password text, p_new_password text
)
returns json language plpgsql security definer as $$
declare caller json; v_admin_id uuid; admin_record record;
begin
  caller := public.admin_validate_session(p_admin_token);
  if not (caller->>'valid')::boolean then
    return json_build_object('success',false,'error','Unauthorized'); end if;
  v_admin_id := (caller->'admin'->>'id')::uuid;
  select * into admin_record from public.admin_users where id=v_admin_id;
  if not (admin_record.password_hash = crypt(p_old_password, admin_record.password_hash)) then
    return json_build_object('success',false,'error','Current password is incorrect'); end if;
  update public.admin_users
  set password_hash=crypt(p_new_password, gen_salt('bf',12)), last_password_change_at=now()
  where id=v_admin_id;
  delete from public.admin_sessions where admin_id=v_admin_id;
  return json_build_object('success',true,'message','Password changed. Please login again.');
end; $$;

-- ==========================================
-- CATEGORY CLEANUP TRIGGER
-- ==========================================

drop trigger if exists trg_cleanup_deleted_categories on public.users;
drop function if exists public.cleanup_deleted_category_budgets();

create or replace function public.cleanup_deleted_category_budgets()
returns trigger language plpgsql as $$
begin
  if old.custom_categories is not distinct from new.custom_categories then return new; end if;

  with
    old_keys as (select distinct public.custom_key_canonical(elem) as ck, public.custom_key_raw_name(elem) as rk from jsonb_array_elements(public.custom_categories_to_array(old.custom_categories)) elem),
    new_keys as (select distinct public.custom_key_canonical(elem) as ck from jsonb_array_elements(public.custom_categories_to_array(new.custom_categories)) elem),
    deleted as (select o.ck, o.rk from old_keys o where o.ck is not null and not exists (select 1 from new_keys n where n.ck = o.ck)),
    variants as (select distinct lower(ck) as k from deleted where ck is not null union select distinct lower(rk) as k from deleted where rk is not null)
  delete from public.category_budgets cb using variants v where cb.user_id=new.id and lower(cb.category)=v.k;

  with
    old_keys as (select distinct public.custom_key_canonical(elem) as ck, public.custom_key_raw_name(elem) as rk from jsonb_array_elements(public.custom_categories_to_array(old.custom_categories)) elem),
    new_keys as (select distinct public.custom_key_canonical(elem) as ck from jsonb_array_elements(public.custom_categories_to_array(new.custom_categories)) elem),
    deleted as (select o.ck, o.rk from old_keys o where o.ck is not null and not exists (select 1 from new_keys n where n.ck = o.ck)),
    variants as (select distinct lower(ck) as k from deleted where ck is not null union select distinct lower(rk) as k from deleted where rk is not null)
  update public.transactions t set category='other', updated_at=now()
  from variants v where t.user_id=new.id and lower(t.category)=v.k;

  with
    old_keys as (select distinct public.custom_key_canonical(elem) as ck, public.custom_key_raw_name(elem) as rk from jsonb_array_elements(public.custom_categories_to_array(old.custom_categories)) elem),
    new_keys as (select distinct public.custom_key_canonical(elem) as ck from jsonb_array_elements(public.custom_categories_to_array(new.custom_categories)) elem),
    deleted as (select o.ck, o.rk from old_keys o where o.ck is not null and not exists (select 1 from new_keys n where n.ck = o.ck)),
    variants as (select distinct lower(ck) as k from deleted where ck is not null union select distinct lower(rk) as k from deleted where rk is not null)
  update public.recurring_transactions rt set category='other', updated_at=now()
  from variants v where rt.user_id=new.id and lower(rt.category)=v.k;

  return new;
end; $$;

create trigger trg_cleanup_deleted_categories
  after update of custom_categories on public.users
  for each row execute function public.cleanup_deleted_category_budgets();

-- ==========================================
-- CLEANUP & BACKFILL
-- ==========================================

delete from public.budgets a using public.budgets b
where a.ctid < b.ctid and a.user_id=b.user_id and a.month=b.month;

delete from public.category_budgets a using public.category_budgets b
where a.ctid < b.ctid and a.user_id=b.user_id and a.month=b.month and lower(a.category)=lower(b.category);

insert into public.subscriptions (user_id, status, plan)
select u.id, 'free', 'free' from public.users u
where not exists (select 1 from public.subscriptions s where s.user_id=u.id)
on conflict (user_id) do nothing;

insert into public.review_queue_items (user_id, status, priority, source, risk_score_snapshot, latest_reason, opened_at)
select u.id,
  case when u.status='banned' then 'restricted'::public.review_queue_status else 'under_review'::public.review_queue_status end,
  case when coalesce(u.risk_score,0) >= 80 then 'high' else 'normal' end,
  'backfill', coalesce(u.risk_score,0), concat('Backfilled: ', u.status::text), now()
from public.users u
where u.status in ('under_review','flagged','banned')
on conflict (user_id) do nothing;

-- ==========================================
-- SEED DATA
-- ==========================================

insert into public.admin_roles (key, name, description, is_system) values
  ('super_admin',      'Super Admin',       'Full system access',                             true),
  ('operations_admin', 'Operations Admin',  'Operations control for users and subscriptions', true),
  ('support_admin',    'Support Admin',     'Customer support and account assistance',         true),
  ('finance_admin',    'Finance Admin',     'Billing, subscriptions, and refunds',             true),
  ('moderation_admin', 'Moderation Admin',  'Moderation, risk, and review tooling',            true),
  ('analyst',          'Analyst',           'Read-only analytical access',                     true)
on conflict (key) do update set name=excluded.name, description=excluded.description;

insert into public.admin_permissions (key, label, description) values
  ('dashboard.view',           'View dashboard',            'Read dashboard metrics'),
  ('users.view',               'View users',                'Read user lists and profiles'),
  ('users.edit',               'Edit users',                'Update user fields'),
  ('users.suspend',            'Suspend users',             'Suspend user access'),
  ('users.ban',                'Ban users',                 'Ban user access'),
  ('users.reactivate',         'Reactivate users',          'Restore user access'),
  ('users.soft_delete',        'Soft delete users',         'Soft delete users'),
  ('users.sessions.manage',    'Manage user sessions',      'Revoke user sessions'),
  ('users.impersonate',        'Impersonate users',         'Impersonate a user session'),
  ('users.export',             'Export users',              'Export user data'),
  ('subscriptions.view',       'View subscriptions',        'Read subscription data'),
  ('subscriptions.manage',     'Manage subscriptions',      'Change subscription states'),
  ('billing.view',             'View billing',              'Read billing and payment data'),
  ('billing.refunds.issue',    'Issue refunds',             'Issue refunds and finance exceptions'),
  ('finance.notes.manage',     'Manage finance notes',      'Add finance notes'),
  ('finance.view',             'View finance',              'Read finance dashboards'),
  ('finance.manage',           'Manage finance',            'Run finance workflows'),
  ('support.view',             'View support data',         'Read support context'),
  ('support.notes.manage',     'Manage support notes',      'Add internal support notes'),
  ('tags.manage',              'Manage tags',               'Assign and remove user tags'),
  ('flags.manage',             'Manage flags',              'Assign and resolve user flags'),
  ('risk.view',                'View risk',                 'Read risk signals'),
  ('risk.manage',              'Manage risk',               'Update risk decisions'),
  ('reviews.manage',           'Manage reviews',            'Manage review queue'),
  ('review_queue.manage',      'Manage review queue',       'Manage review queue state'),
  ('audit_logs.view',          'View audit logs',           'Read admin audit logs'),
  ('activity_logs.view',       'View activity logs',        'Read operational logs'),
  ('admins.view',              'View admins',               'Read admin list'),
  ('admins.create',            'Create admins',             'Create new admin users'),
  ('admins.edit',              'Edit admins',               'Update admin profile/roles'),
  ('admins.deactivate',        'Deactivate admins',         'Deactivate admin access'),
  ('admins.sessions.manage',   'Manage admin sessions',     'Revoke admin sessions'),
  ('roles.assign',             'Assign roles',              'Assign admin roles'),
  ('permissions.manage',       'Manage permissions',        'Manage custom permissions'),
  ('orders.view',              'View orders',               'Read order data'),
  ('orders.manage',            'Manage orders',             'Update order state'),
  ('content.manage',           'Manage content',            'Create and delete internal content'),
  ('saved_views.manage',       'Manage saved views',        'Create and edit saved filters'),
  ('bulk_actions.run',         'Run bulk actions',          'Execute bulk operational actions'),
  ('feature_flags.view',       'View feature flags',        'Read feature flag configuration'),
  ('feature_flags.manage',     'Manage feature flags',      'Update feature flags'),
  ('internal_settings.view',   'View internal settings',    'Read operational settings'),
  ('internal_settings.manage', 'Manage internal settings',  'Update internal settings'),
  ('exports.view',             'View export jobs',          'Read export job history'),
  ('exports.run',              'Run exports',               'Export sensitive data'),
  ('exports.manage',           'Manage exports',            'Generate and download exports'),
  ('user_sessions.view',       'View user sessions',        'Read user session inventory'),
  ('user_sessions.manage',     'Manage user sessions',      'Revoke user sessions'),
  ('support_handoffs.manage',  'Manage support handoffs',   'Create and manage support handoffs'),
  ('approvals.manage',         'Manage approvals',          'Review and approve sensitive actions')
on conflict (key) do nothing;

with rp(rk, pk) as (values
  ('super_admin','dashboard.view'),('super_admin','users.view'),('super_admin','users.edit'),('super_admin','users.suspend'),('super_admin','users.ban'),('super_admin','users.reactivate'),('super_admin','users.soft_delete'),('super_admin','users.sessions.manage'),('super_admin','users.impersonate'),('super_admin','users.export'),
  ('super_admin','subscriptions.view'),('super_admin','subscriptions.manage'),('super_admin','billing.view'),('super_admin','billing.refunds.issue'),('super_admin','finance.notes.manage'),('super_admin','finance.view'),('super_admin','finance.manage'),
  ('super_admin','support.view'),('super_admin','support.notes.manage'),('super_admin','tags.manage'),('super_admin','flags.manage'),('super_admin','risk.view'),('super_admin','risk.manage'),('super_admin','reviews.manage'),('super_admin','review_queue.manage'),
  ('super_admin','audit_logs.view'),('super_admin','activity_logs.view'),('super_admin','admins.view'),('super_admin','admins.create'),('super_admin','admins.edit'),('super_admin','admins.deactivate'),('super_admin','admins.sessions.manage'),
  ('super_admin','roles.assign'),('super_admin','permissions.manage'),('super_admin','orders.view'),('super_admin','orders.manage'),('super_admin','content.manage'),('super_admin','saved_views.manage'),('super_admin','bulk_actions.run'),
  ('super_admin','feature_flags.view'),('super_admin','feature_flags.manage'),('super_admin','internal_settings.view'),('super_admin','internal_settings.manage'),
  ('super_admin','exports.view'),('super_admin','exports.run'),('super_admin','exports.manage'),('super_admin','user_sessions.view'),('super_admin','user_sessions.manage'),('super_admin','support_handoffs.manage'),('super_admin','approvals.manage'),
  ('operations_admin','dashboard.view'),('operations_admin','users.view'),('operations_admin','users.edit'),('operations_admin','users.suspend'),('operations_admin','users.reactivate'),('operations_admin','users.sessions.manage'),('operations_admin','user_sessions.view'),('operations_admin','user_sessions.manage'),
  ('operations_admin','subscriptions.view'),('operations_admin','subscriptions.manage'),('operations_admin','finance.view'),('operations_admin','finance.manage'),('operations_admin','support.view'),('operations_admin','support.notes.manage'),('operations_admin','support_handoffs.manage'),
  ('operations_admin','tags.manage'),('operations_admin','flags.manage'),('operations_admin','risk.view'),('operations_admin','reviews.manage'),('operations_admin','review_queue.manage'),('operations_admin','audit_logs.view'),('operations_admin','activity_logs.view'),
  ('operations_admin','admins.sessions.manage'),('operations_admin','orders.view'),('operations_admin','orders.manage'),('operations_admin','content.manage'),('operations_admin','saved_views.manage'),('operations_admin','bulk_actions.run'),('operations_admin','approvals.manage'),
  ('support_admin','dashboard.view'),('support_admin','users.view'),('support_admin','users.edit'),('support_admin','users.sessions.manage'),('support_admin','user_sessions.view'),('support_admin','user_sessions.manage'),
  ('support_admin','support.view'),('support_admin','support.notes.manage'),('support_admin','support_handoffs.manage'),('support_admin','tags.manage'),('support_admin','flags.manage'),('support_admin','saved_views.manage'),('support_admin','activity_logs.view'),
  ('finance_admin','dashboard.view'),('finance_admin','users.view'),('finance_admin','subscriptions.view'),('finance_admin','subscriptions.manage'),('finance_admin','billing.view'),('finance_admin','billing.refunds.issue'),
  ('finance_admin','finance.notes.manage'),('finance_admin','finance.view'),('finance_admin','finance.manage'),('finance_admin','audit_logs.view'),('finance_admin','activity_logs.view'),
  ('finance_admin','orders.view'),('finance_admin','orders.manage'),('finance_admin','exports.view'),('finance_admin','exports.run'),('finance_admin','exports.manage'),('finance_admin','saved_views.manage'),
  ('moderation_admin','dashboard.view'),('moderation_admin','users.view'),('moderation_admin','users.suspend'),('moderation_admin','users.ban'),('moderation_admin','users.reactivate'),
  ('moderation_admin','support.notes.manage'),('moderation_admin','tags.manage'),('moderation_admin','flags.manage'),('moderation_admin','risk.view'),('moderation_admin','risk.manage'),
  ('moderation_admin','reviews.manage'),('moderation_admin','review_queue.manage'),('moderation_admin','saved_views.manage'),('moderation_admin','activity_logs.view'),
  ('analyst','dashboard.view'),('analyst','users.view'),('analyst','subscriptions.view'),('analyst','billing.view'),('analyst','finance.view'),('analyst','support.view'),('analyst','risk.view'),
  ('analyst','audit_logs.view'),('analyst','activity_logs.view'),('analyst','orders.view'),('analyst','saved_views.manage'),('analyst','feature_flags.view'),('analyst','internal_settings.view'),('analyst','exports.view'),('analyst','user_sessions.view')
)
insert into public.admin_role_permissions (role_id, permission_key)
select r.id, rp.pk from rp join public.admin_roles r on r.key=rp.rk
on conflict (role_id, permission_key) do nothing;

insert into public.user_tags (key, label, color, description, is_system) values
  ('vip',               'VIP',              'amber',  'High-value user',          true),
  ('high_value',        'High Value',        'green',  'High LTV user',            true),
  ('manual_review',     'Manual Review',     'orange', 'Needs review',             true),
  ('support_follow_up', 'Support Follow-up', 'blue',   'Support should follow up', true),
  ('churn_risk',        'Churn Risk',        'red',    'Likely to churn',          true)
on conflict (key) do nothing;

insert into public.user_flags (key, label, description, severity, is_system) values
  ('fraud_risk',         'Fraud Risk',         'Potential fraud or abuse',         'critical', true),
  ('support_escalation', 'Support Escalation', 'Support escalation required',      'warning',  true),
  ('finance_review',     'Finance Review',     'Finance review needed',            'warning',  true),
  ('urgent_review',      'Urgent Review',      'Urgent operational review needed', 'critical', true),
  ('moderation_review',  'Moderation Review',  'Moderation review required',       'warning',  true)
on conflict (key) do nothing;

-- ==========================================
-- DEFAULT SUPER ADMIN
-- ⚠️ بعد از لاگین اول پسورد رو عوض کن
-- ==========================================

insert into public.admin_users (username, password_hash, display_name, email, role, is_active)
values ('admin', crypt('Admin@12345', gen_salt('bf',12)), 'Super Admin', 'admin@centmond.com', 'super_admin', true)
on conflict (username) do update set display_name=excluded.display_name, role=excluded.role, email=excluded.email;

update public.admin_users set status='active'::public.admin_account_status where username='admin';

insert into public.admin_user_roles (admin_id, role_id)
select au.id, ar.id from public.admin_users au join public.admin_roles ar on ar.key='super_admin' where au.username='admin'
on conflict (admin_id, role_id) do nothing;

insert into public.admin_user_roles (admin_id, role_id)
select au.id, ar.id from public.admin_users au
join public.admin_roles ar on ar.key = case
  when au.role='super_admin' then 'super_admin'
  when au.role in ('admin','viewer') then 'analyst'
  else coalesce(au.role,'analyst') end
on conflict (admin_id, role_id) do nothing;

-- ==========================================
-- RLS
-- ==========================================

alter table public.users enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.category_budgets enable row level security;
alter table public.events enable row level security;
alter table public.app_state enable row level security;
alter table public.recurring_transactions enable row level security;
alter table public.subscriptions enable row level security;
alter table public.admin_users enable row level security;
alter table public.admin_sessions enable row level security;
alter table public.admin_roles enable row level security;
alter table public.admin_permissions enable row level security;
alter table public.admin_role_permissions enable row level security;
alter table public.admin_user_roles enable row level security;
alter table public.admin_login_attempts enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.user_notes enable row level security;
alter table public.user_tags enable row level security;
alter table public.user_tag_assignments enable row level security;
alter table public.user_flags enable row level security;
alter table public.user_flag_assignments enable row level security;
alter table public.saved_views enable row level security;
alter table public.user_devices enable row level security;
alter table public.user_sessions enable row level security;
alter table public.finance_events enable row level security;
alter table public.support_handoffs enable row level security;
alter table public.bulk_jobs enable row level security;
alter table public.export_jobs enable row level security;
alter table public.feature_flags enable row level security;
alter table public.internal_settings enable row level security;
alter table public.review_queue_items enable row level security;

drop policy if exists users_own_rows on public.users;
create policy users_own_rows on public.users for all to authenticated using (auth.uid()=id) with check (auth.uid()=id);
drop policy if exists transactions_own_rows on public.transactions;
create policy transactions_own_rows on public.transactions for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
drop policy if exists budgets_own_rows on public.budgets;
create policy budgets_own_rows on public.budgets for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
drop policy if exists category_budgets_own_rows on public.category_budgets;
create policy category_budgets_own_rows on public.category_budgets for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
drop policy if exists events_own_rows on public.events;
create policy events_own_rows on public.events for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
drop policy if exists app_state_own_rows on public.app_state;
create policy app_state_own_rows on public.app_state for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
drop policy if exists recurring_transactions_own_rows on public.recurring_transactions;
create policy recurring_transactions_own_rows on public.recurring_transactions for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
drop policy if exists subscriptions_select_own on public.subscriptions;
create policy subscriptions_select_own on public.subscriptions for select to authenticated using (auth.uid()=user_id);
drop policy if exists subscriptions_insert_own on public.subscriptions;
create policy subscriptions_insert_own on public.subscriptions for insert to authenticated with check (auth.uid()=user_id);
drop policy if exists subscriptions_update_own on public.subscriptions;
create policy subscriptions_update_own on public.subscriptions for update to authenticated using (auth.uid()=user_id);

drop policy if exists admin_users_no_direct on public.admin_users;
create policy admin_users_no_direct on public.admin_users for all to authenticated, anon using (false);
drop policy if exists admin_sessions_no_direct on public.admin_sessions;
create policy admin_sessions_no_direct on public.admin_sessions for all to authenticated, anon using (false);

-- ==========================================
-- GRANTS
-- ==========================================

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.users to authenticated;
grant select, insert, update, delete on public.transactions to authenticated;
grant select, insert, update, delete on public.budgets to authenticated;
grant select, insert, update, delete on public.category_budgets to authenticated;
grant select, insert, update, delete on public.events to authenticated;
grant select, insert, update, delete on public.app_state to authenticated;
grant select, insert, update, delete on public.recurring_transactions to authenticated;
grant select, insert, update on public.subscriptions to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function public.is_user_premium(uuid) to authenticated;
grant execute on function public.get_subscription_info(uuid) to authenticated;
grant execute on function public.start_trial(uuid) to authenticated;
grant execute on function public.admin_login(text, text) to anon, authenticated;
grant execute on function public.admin_validate_session(text) to anon, authenticated;
grant execute on function public.admin_logout(text) to anon, authenticated;
grant execute on function public.admin_create_user(text, text, text, text, text) to anon, authenticated;
grant execute on function public.admin_change_password(text, text, text) to anon, authenticated;

commit;

-- ==========================================
-- VERIFICATION
-- ==========================================

select table_name from information_schema.tables where table_schema='public' order by table_name;
select id, username, display_name, email, role, is_active from public.admin_users;
select r.key, count(rp.permission_key) as perms from public.admin_roles r left join public.admin_role_permissions rp on rp.role_id=r.id group by r.key order by r.key;
select public.admin_login('admin', 'Admin@12345');