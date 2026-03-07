export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// --- Row types ---
export type UserRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "editor" | "viewer";
  status: "active" | "inactive" | "suspended";
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  last_login: string | null;
};

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

// --- Supabase Database generic ---
export type Database = {
  public: {
    Tables: {
      users: {
        Row: UserRow;
        Insert: Omit<UserRow, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<UserRow, "id" | "created_at">>;
      };
      orders: {
        Row: OrderRow;
        Insert: Omit<OrderRow, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<OrderRow, "id" | "created_at">>;
      };
      content: {
        Row: ContentRow;
        Insert: Omit<ContentRow, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<ContentRow, "id" | "created_at">>;
      };
      activity_logs: {
        Row: ActivityLogRow;
        Insert: Omit<ActivityLogRow, "id" | "created_at">;
        Update: never;
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: {
      user_role: "admin" | "editor" | "viewer";
      user_status: "active" | "inactive" | "suspended";
      order_status: "pending" | "processing" | "completed" | "cancelled" | "refunded";
      content_status: "draft" | "published" | "archived";
    };
  };
};
