import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminRole } from "@/lib/admin-auth";

interface AdminLoginRpcResponse {
  success?: boolean;
  error?: string;
  admin?: {
    id?: string;
    username?: string;
    role?: string;
  };
}

export interface AuthenticatedAdmin {
  id: string;
  username: string;
  role: AdminRole;
}

interface AuthenticateAdminResult {
  admin?: AuthenticatedAdmin;
  error?: string;
}

function isAdminRole(value: string): value is AdminRole {
  return value === "super_admin" || value === "admin" || value === "viewer";
}

function normalizeError(error?: string): string {
  return error?.trim() || "Invalid username or password";
}

export async function authenticateAdmin(
  username: string,
  password: string
): Promise<AuthenticateAdminResult> {
  const normalizedUsername = username.trim().toLowerCase();
  if (!normalizedUsername || !password) {
    return { error: "Username and password are required" };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("admin_login", {
    p_username: normalizedUsername,
    p_password: password,
  });

  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    return { error: "Invalid username or password" };
  }

  const result = data as AdminLoginRpcResponse;
  if (!result.success || !result.admin) {
    return { error: normalizeError(result.error) };
  }

  const { id, username: adminUsername, role } = result.admin;
  if (!id || !adminUsername || !role || !isAdminRole(role)) {
    return { error: "Invalid admin account data" };
  }

  return {
    admin: {
      id,
      username: adminUsername,
      role,
    },
  };
}
