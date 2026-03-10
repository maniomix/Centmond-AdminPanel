export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// --- Core app row types (aligned with live DB) ---
export type UserRow = {
  id: string;
  email: string;
  display_name: string | null;
  status:
    | "active"
    | "suspended"
    | "banned"
    | "flagged"
    | "under_review"
    | "pending_verification"
    | "soft_deleted"
    | "inactive";
  phone: string | null;
  phone_verified: boolean;
  username: string | null;
  full_name: string | null;
  auth_provider: string | null;
  profile_image_url: string | null;
  profile_image: string | null;
  is_email_verified: boolean;
  custom_categories: Json | string | null;
  last_active_at: string | null;
  last_login_at: string | null;
  country_code: string | null;
  region: string | null;
  locale: string | null;
  billing_status: string | null;
  risk_score: number;
  risk_status: string | null;
  referral_code: string | null;
  referred_by_code: string | null;
  onboarding_status: string | null;
  vip_status: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TransactionRow = {
  id: string;
  user_id: string;
  amount: number;
  category: string;
  type: "income" | "expense";
  note: string | null;
  date: string; // YYYY-MM-DD
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
};

export type SubscriptionRow = {
  id: string;
  user_id: string;
  plan: string;
  status: string;
  trial_start: string | null;
  trial_end: string | null;
  subscription_start: string | null;
  subscription_end: string | null;
  platform: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  apple_transaction_id: string | null;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
};

export type EventRow = {
  id: string;
  user_id: string | null;
  event_name: string;
  event_properties: Json | null;
  session_id: string | null;
  device_info: Json | null;
  created_at: string;
};

// --- Legacy/optional row types (kept for backward compatibility in routes) ---
export type OrderRow = {
  id: string;
  order_number: string;
  user_id: string;
  status: "pending" | "processing" | "completed" | "cancelled" | "refunded";
  total_amount: number;
  currency: string;
  items: Json;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ContentRow = {
  id: string;
  title: string;
  slug: string;
  body: string | null;
  status: "draft" | "published" | "archived";
  author_id: string;
  category: string | null;
  tags: string[] | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ActivityLogRow = {
  id: string;
  admin_id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: Json | null;
  ip_address: string | null;
  created_at: string;
};

// --- Admin panel row types ---
export type AdminUserRow = {
  id: string;
  username: string;
  email: string | null;
  password_hash: string;
  display_name: string | null;
  role:
    | "super_admin"
    | "operations_admin"
    | "support_admin"
    | "finance_admin"
    | "moderation_admin"
    | "analyst"
    | "admin"
    | "viewer";
  status: "active" | "suspended" | "deactivated";
  is_active: boolean;
  mfa_enabled: boolean;
  last_login_at: string | null;
  last_login_ip: string | null;
  last_login_user_agent: string | null;
  last_password_change_at: string | null;
  must_reauth_after: string | null;
  failed_login_count: number;
  last_failed_login_at: string | null;
  allowed_ip_cidrs: string[] | null;
  created_at: string;
  updated_at: string;
};

export type AdminSessionRow = {
  id: string;
  admin_id: string;
  token: string | null;
  token_hash: string | null;
  session_label: string | null;
  device_label: string | null;
  ip_address: string | null;
  user_agent: string | null;
  last_seen_at: string;
  expires_at: string;
  idle_expires_at: string;
  last_sensitive_auth_at: string | null;
  revoked_at: string | null;
  revoked_reason: string | null;
  mfa_verified_at: string | null;
  created_at: string;
};

export type AdminRoleRow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  status: "active" | "inactive";
  is_system: boolean;
  parent_role_id: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminPermissionRow = {
  key: string;
  label: string;
  description: string | null;
  created_at: string;
};

export type AdminRolePermissionRow = {
  role_id: string;
  permission_key: string;
  created_at: string;
};

export type AdminUserRoleRow = {
  admin_id: string;
  role_id: string;
  assigned_by_admin_id: string | null;
  created_at: string;
};

export type AdminLoginAttemptRow = {
  id: string;
  admin_id: string | null;
  identifier: string;
  success: boolean;
  failure_reason: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

export type AdminAuditLogRow = {
  id: string;
  actor_admin_id: string | null;
  actor_role: string | null;
  action_type: string;
  category:
    | "auth"
    | "admin"
    | "user"
    | "subscription"
    | "billing"
    | "support"
    | "risk"
    | "search"
    | "export"
    | "config"
    | "security"
    | "bulk";
  severity: "info" | "warning" | "critical";
  target_entity_type: string | null;
  target_entity_id: string | null;
  target_summary: string | null;
  reason: string | null;
  before_state: Json | null;
  after_state: Json | null;
  metadata: Json | null;
  request_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  approved_by_admin_id: string | null;
  approved_at: string | null;
  created_at: string;
};

export type UserNoteRow = {
  id: string;
  user_id: string;
  author_admin_id: string | null;
  note_type: "general" | "support" | "finance" | "risk" | "moderation";
  body: string;
  is_pinned: boolean;
  is_internal_only: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type UserTagRow = {
  id: string;
  key: string;
  label: string;
  color: string | null;
  description: string | null;
  is_system: boolean;
  created_at: string;
};

export type UserTagAssignmentRow = {
  user_id: string;
  tag_id: string;
  assigned_by_admin_id: string | null;
  created_at: string;
};

export type UserFlagRow = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  severity: "info" | "warning" | "critical";
  is_system: boolean;
  created_at: string;
};

export type UserFlagAssignmentRow = {
  id: string;
  user_id: string;
  flag_id: string;
  status: "active" | "resolved" | "dismissed";
  reason: string | null;
  assigned_by_admin_id: string | null;
  resolved_by_admin_id: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SavedViewRow = {
  id: string;
  owner_admin_id: string | null;
  scope: "users" | "admins" | "subscriptions" | "audit_logs";
  name: string;
  description: string | null;
  filters: Json;
  columns: Json | null;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
};

export type UserDeviceRow = {
  id: string;
  user_id: string;
  device_fingerprint: string;
  device_label: string | null;
  platform: string | null;
  os: string | null;
  browser: string | null;
  model: string | null;
  metadata: Json | null;
  first_seen_at: string;
  last_seen_at: string;
  last_ip_address: string | null;
  last_country_code: string | null;
  last_region: string | null;
  is_suspicious: boolean;
  created_at: string;
  updated_at: string;
};

export type UserSessionRow = {
  id: string;
  user_id: string;
  device_id: string | null;
  session_token_hash: string | null;
  session_label: string | null;
  ip_address: string | null;
  country_code: string | null;
  region: string | null;
  user_agent: string | null;
  status: "active" | "revoked" | "expired" | "suspicious";
  started_at: string;
  last_seen_at: string;
  expires_at: string | null;
  ended_at: string | null;
  revoked_at: string | null;
  revoked_reason: string | null;
  revoked_by_admin_id: string | null;
  require_reauth: boolean;
  metadata: Json | null;
  created_at: string;
};

export type FinanceEventRow = {
  id: string;
  user_id: string | null;
  subscription_id: string | null;
  transaction_id: string | null;
  actor_admin_id: string | null;
  event_type: string;
  status: "recorded" | "pending_provider_action" | "resolved" | "cancelled";
  amount: number | null;
  currency: string;
  provider: string | null;
  reference_id: string | null;
  reason: string | null;
  note: string | null;
  metadata: Json | null;
  created_at: string;
  updated_at: string;
};

export type SupportHandoffRow = {
  id: string;
  user_id: string;
  from_admin_id: string | null;
  to_admin_id: string | null;
  status: "open" | "in_progress" | "resolved";
  priority: string;
  summary: string;
  details: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

export type BulkJobRow = {
  id: string;
  created_by_admin_id: string | null;
  job_type: string;
  target_scope: string;
  status: "queued" | "processing" | "completed" | "partially_completed" | "failed";
  reason: string | null;
  input: Json;
  result: Json | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ExportJobRow = {
  id: string;
  created_by_admin_id: string | null;
  export_type: string;
  target_scope: string;
  status: "queued" | "processing" | "completed" | "failed" | "expired";
  format: string;
  filters: Json | null;
  row_count: number | null;
  file_name: string | null;
  reason: string | null;
  content: string | null;
  metadata: Json | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export type FeatureFlagRow = {
  key: string;
  label: string;
  description: string | null;
  enabled: boolean;
  rollout_percentage: number;
  audience_filters: Json | null;
  updated_by_admin_id: string | null;
  created_at: string;
  updated_at: string;
};

export type InternalSettingRow = {
  key: string;
  label: string;
  description: string | null;
  value: Json;
  is_sensitive: boolean;
  updated_by_admin_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ReviewQueueItemRow = {
  id: string;
  user_id: string;
  status:
    | "under_review"
    | "escalated"
    | "approved"
    | "rejected"
    | "restricted"
    | "false_positive"
    | "resolved";
  priority: string;
  source: string | null;
  created_by_admin_id: string | null;
  assigned_to_admin_id: string | null;
  last_decided_by_admin_id: string | null;
  risk_score_snapshot: number | null;
  latest_reason: string | null;
  metadata: Json | null;
  opened_at: string;
  last_decided_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      users: {
        Row: UserRow;
        Insert: Omit<UserRow, "created_at" | "updated_at">;
        Update: Partial<Omit<UserRow, "id" | "created_at">>;
        Relationships: [];
      };
      transactions: {
        Row: TransactionRow;
        Insert: Omit<TransactionRow, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<TransactionRow, "id" | "created_at">>;
        Relationships: [];
      };
      subscriptions: {
        Row: SubscriptionRow;
        Insert: Omit<SubscriptionRow, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<SubscriptionRow, "id" | "created_at">>;
        Relationships: [];
      };
      events: {
        Row: EventRow;
        Insert: Omit<EventRow, "id" | "created_at">;
        Update: Partial<EventRow>;
        Relationships: [];
      };
      admin_users: {
        Row: AdminUserRow;
        Insert: {
          username: string;
          email?: string | null;
          password_hash: string;
          display_name?: string | null;
          role?: AdminUserRow["role"];
          status?: AdminUserRow["status"];
          is_active?: boolean;
          mfa_enabled?: boolean;
          last_login_at?: string | null;
          last_login_ip?: string | null;
          last_login_user_agent?: string | null;
          last_password_change_at?: string | null;
          must_reauth_after?: string | null;
          failed_login_count?: number;
          last_failed_login_at?: string | null;
          allowed_ip_cidrs?: string[] | null;
        };
        Update: Partial<Omit<AdminUserRow, "id" | "created_at">>;
        Relationships: [];
      };
      admin_roles: {
        Row: AdminRoleRow;
        Insert: Omit<AdminRoleRow, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<AdminRoleRow, "id" | "created_at">>;
        Relationships: [];
      };
      admin_permissions: {
        Row: AdminPermissionRow;
        Insert: Omit<AdminPermissionRow, "created_at">;
        Update: Partial<Omit<AdminPermissionRow, "created_at">>;
        Relationships: [];
      };
      admin_role_permissions: {
        Row: AdminRolePermissionRow;
        Insert: Omit<AdminRolePermissionRow, "created_at">;
        Update: Partial<AdminRolePermissionRow>;
        Relationships: [];
      };
      admin_user_roles: {
        Row: AdminUserRoleRow;
        Insert: {
          admin_id: string;
          role_id: string;
          assigned_by_admin_id?: string | null;
        };
        Update: Partial<AdminUserRoleRow>;
        Relationships: [];
      };
      admin_sessions: {
        Row: AdminSessionRow;
        Insert: {
          admin_id: string;
          token?: string | null;
          token_hash?: string | null;
          session_label?: string | null;
          device_label?: string | null;
          ip_address?: string | null;
          user_agent?: string | null;
          last_seen_at?: string;
          expires_at: string;
          idle_expires_at: string;
          revoked_at?: string | null;
          revoked_reason?: string | null;
          mfa_verified_at?: string | null;
        };
        Update: Partial<AdminSessionRow>;
        Relationships: [];
      };
      admin_login_attempts: {
        Row: AdminLoginAttemptRow;
        Insert: Omit<AdminLoginAttemptRow, "id" | "created_at">;
        Update: Partial<AdminLoginAttemptRow>;
        Relationships: [];
      };
      admin_audit_logs: {
        Row: AdminAuditLogRow;
        Insert: {
          actor_admin_id?: string | null;
          actor_role?: string | null;
          action_type: string;
          category: AdminAuditLogRow["category"];
          severity?: AdminAuditLogRow["severity"];
          target_entity_type?: string | null;
          target_entity_id?: string | null;
          target_summary?: string | null;
          reason?: string | null;
          before_state?: Json | null;
          after_state?: Json | null;
          metadata?: Json | null;
          request_id?: string | null;
          ip_address?: string | null;
          user_agent?: string | null;
          approved_by_admin_id?: string | null;
          approved_at?: string | null;
        };
        Update: Partial<AdminAuditLogRow>;
        Relationships: [];
      };
      user_notes: {
        Row: UserNoteRow;
        Insert: {
          user_id: string;
          author_admin_id?: string | null;
          note_type?: UserNoteRow["note_type"];
          body: string;
          is_pinned?: boolean;
          is_internal_only?: boolean;
          deleted_at?: string | null;
        };
        Update: Partial<Omit<UserNoteRow, "id" | "created_at">>;
        Relationships: [];
      };
      user_tags: {
        Row: UserTagRow;
        Insert: Omit<UserTagRow, "id" | "created_at">;
        Update: Partial<UserTagRow>;
        Relationships: [];
      };
      user_tag_assignments: {
        Row: UserTagAssignmentRow;
        Insert: {
          user_id: string;
          tag_id: string;
          assigned_by_admin_id?: string | null;
        };
        Update: Partial<UserTagAssignmentRow>;
        Relationships: [];
      };
      user_flags: {
        Row: UserFlagRow;
        Insert: Omit<UserFlagRow, "id" | "created_at">;
        Update: Partial<UserFlagRow>;
        Relationships: [];
      };
      user_flag_assignments: {
        Row: UserFlagAssignmentRow;
        Insert: {
          user_id: string;
          flag_id: string;
          status?: UserFlagAssignmentRow["status"];
          reason?: string | null;
          assigned_by_admin_id?: string | null;
          resolved_by_admin_id?: string | null;
          resolved_at?: string | null;
        };
        Update: Partial<Omit<UserFlagAssignmentRow, "id" | "created_at">>;
        Relationships: [];
      };
      saved_views: {
        Row: SavedViewRow;
        Insert: Omit<SavedViewRow, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<SavedViewRow, "id" | "created_at">>;
        Relationships: [];
      };
      user_devices: {
        Row: UserDeviceRow;
        Insert: {
          user_id: string;
          device_fingerprint: string;
          device_label?: string | null;
          platform?: string | null;
          os?: string | null;
          browser?: string | null;
          model?: string | null;
          metadata?: Json | null;
          first_seen_at?: string;
          last_seen_at?: string;
          last_ip_address?: string | null;
          last_country_code?: string | null;
          last_region?: string | null;
          is_suspicious?: boolean;
        };
        Update: Partial<Omit<UserDeviceRow, "id" | "user_id" | "created_at">>;
        Relationships: [];
      };
      user_sessions: {
        Row: UserSessionRow;
        Insert: {
          user_id: string;
          device_id?: string | null;
          session_token_hash?: string | null;
          session_label?: string | null;
          ip_address?: string | null;
          country_code?: string | null;
          region?: string | null;
          user_agent?: string | null;
          status?: UserSessionRow["status"];
          started_at?: string;
          last_seen_at?: string;
          expires_at?: string | null;
          ended_at?: string | null;
          revoked_at?: string | null;
          revoked_reason?: string | null;
          revoked_by_admin_id?: string | null;
          require_reauth?: boolean;
          metadata?: Json | null;
        };
        Update: Partial<Omit<UserSessionRow, "id" | "user_id" | "created_at">>;
        Relationships: [];
      };
      finance_events: {
        Row: FinanceEventRow;
        Insert: {
          user_id?: string | null;
          subscription_id?: string | null;
          transaction_id?: string | null;
          actor_admin_id?: string | null;
          event_type: string;
          status?: FinanceEventRow["status"];
          amount?: number | null;
          currency?: string;
          provider?: string | null;
          reference_id?: string | null;
          reason?: string | null;
          note?: string | null;
          metadata?: Json | null;
        };
        Update: Partial<Omit<FinanceEventRow, "id" | "created_at">>;
        Relationships: [];
      };
      support_handoffs: {
        Row: SupportHandoffRow;
        Insert: {
          user_id: string;
          from_admin_id?: string | null;
          to_admin_id?: string | null;
          status?: SupportHandoffRow["status"];
          priority?: string;
          summary: string;
          details?: string | null;
          resolved_at?: string | null;
        };
        Update: Partial<Omit<SupportHandoffRow, "id" | "created_at">>;
        Relationships: [];
      };
      bulk_jobs: {
        Row: BulkJobRow;
        Insert: {
          created_by_admin_id?: string | null;
          job_type: string;
          target_scope?: string;
          status?: BulkJobRow["status"];
          reason?: string | null;
          input: Json;
          result?: Json | null;
          error_message?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          failed_at?: string | null;
        };
        Update: Partial<Omit<BulkJobRow, "id" | "created_at">>;
        Relationships: [];
      };
      export_jobs: {
        Row: ExportJobRow;
        Insert: {
          created_by_admin_id?: string | null;
          export_type: string;
          target_scope: string;
          status?: ExportJobRow["status"];
          format?: string;
          filters?: Json | null;
          row_count?: number | null;
          file_name?: string | null;
          reason?: string | null;
          content?: string | null;
          metadata?: Json | null;
          error_message?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          failed_at?: string | null;
          expires_at?: string | null;
        };
        Update: Partial<Omit<ExportJobRow, "id" | "created_at">>;
        Relationships: [];
      };
      feature_flags: {
        Row: FeatureFlagRow;
        Insert: {
          key: string;
          label: string;
          description?: string | null;
          enabled?: boolean;
          rollout_percentage?: number;
          audience_filters?: Json | null;
          updated_by_admin_id?: string | null;
        };
        Update: Partial<Omit<FeatureFlagRow, "key" | "created_at">>;
        Relationships: [];
      };
      internal_settings: {
        Row: InternalSettingRow;
        Insert: {
          key: string;
          label: string;
          description?: string | null;
          value?: Json;
          is_sensitive?: boolean;
          updated_by_admin_id?: string | null;
        };
        Update: Partial<Omit<InternalSettingRow, "key" | "created_at">>;
        Relationships: [];
      };
      review_queue_items: {
        Row: ReviewQueueItemRow;
        Insert: {
          user_id: string;
          status?: ReviewQueueItemRow["status"];
          priority?: string;
          source?: string | null;
          created_by_admin_id?: string | null;
          assigned_to_admin_id?: string | null;
          last_decided_by_admin_id?: string | null;
          risk_score_snapshot?: number | null;
          latest_reason?: string | null;
          metadata?: Json | null;
          opened_at?: string;
          last_decided_at?: string | null;
          resolved_at?: string | null;
        };
        Update: Partial<Omit<ReviewQueueItemRow, "id" | "user_id" | "created_at">>;
        Relationships: [];
      };
      // Legacy/optional
      orders: {
        Row: OrderRow;
        Insert: Omit<OrderRow, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<OrderRow, "id" | "created_at">>;
        Relationships: [];
      };
      content: {
        Row: ContentRow;
        Insert: Partial<Omit<ContentRow, "id" | "created_at">> &
          Pick<ContentRow, "title" | "slug" | "status" | "author_id">;
        Update: Partial<Omit<ContentRow, "id" | "created_at">>;
        Relationships: [];
      };
      activity_logs: {
        Row: ActivityLogRow;
        Insert: Omit<ActivityLogRow, "id" | "created_at">;
        Update: Partial<ActivityLogRow>;
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_login: {
        Args: { p_username: string; p_password: string };
        Returns: Json;
      };
      admin_create_user: {
        Args: {
          p_username: string;
          p_email: string;
          p_display_name: string;
          p_password: string;
          p_role?: string;
        };
        Returns: Json;
      };
      admin_change_password: {
        Args: {
          p_admin_id: string;
          p_old_password: string;
          p_new_password: string;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
