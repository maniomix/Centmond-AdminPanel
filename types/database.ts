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
  profile_image_url: string | null;
  profile_image: string | null;
  is_email_verified: boolean;
  custom_categories: Json | string | null;
  last_active_at: string | null;
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
  password_hash: string;
  display_name: string | null;
  role: "super_admin" | "admin" | "viewer";
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminSessionRow = {
  id: string;
  admin_id: string;
  token: string;
  expires_at: string;
  created_at: string;
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
        Insert: Omit<AdminUserRow, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<AdminUserRow, "id" | "created_at">>;
        Relationships: [];
      };
      admin_sessions: {
        Row: AdminSessionRow;
        Insert: Omit<AdminSessionRow, "id" | "created_at">;
        Update: Partial<AdminSessionRow>;
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
      admin_validate_session: {
        Args: { p_token: string };
        Returns: Json;
      };
      admin_logout: {
        Args: { p_token: string };
        Returns: Json;
      };
      admin_change_password: {
        Args: {
          p_admin_token: string;
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
