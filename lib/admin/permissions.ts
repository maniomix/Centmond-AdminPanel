import "server-only";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminSession } from "@/lib/admin-session";
import {
  LEGACY_ROLE_TO_SYSTEM_ROLE,
  SYSTEM_ROLE_PERMISSIONS,
  type AdminPermissionKey,
  type AdminRole,
} from "@/lib/admin/constants";

export interface AdminContext {
  id: string;
  username: string;
  email: string | null;
  displayName: string | null;
  role: AdminRole;
  roleKeys: string[];
  permissions: Set<AdminPermissionKey>;
  status: string;
  mfaEnabled: boolean;
}

function buildLegacyPermissionSet(role: AdminRole): Set<AdminPermissionKey> {
  const normalizedRole = LEGACY_ROLE_TO_SYSTEM_ROLE[role] ?? role;
  return new Set(SYSTEM_ROLE_PERMISSIONS[normalizedRole] ?? []);
}

export async function getAdminContext(): Promise<AdminContext | null> {
  const session = await getAdminSession();
  if (!session) return null;

  const supabase = createAdminClient();
  const { data: admin } = await supabase
    .from("admin_users")
    .select("*")
    .eq("id", session.sub)
    .maybeSingle();

  if (!admin) return null;
  const adminRecord = admin as Record<string, unknown>;
  const role = ((typeof adminRecord.role === "string" ? adminRecord.role : session.role) ??
    "analyst") as AdminRole;

  const { data: roleAssignments } = await supabase
    .from("admin_user_roles")
    .select("role_id")
    .eq("admin_id", admin.id);
  const roleIds = (roleAssignments ?? []).map((row) => row.role_id);

  const { data: roles } = roleIds.length
    ? await supabase.from("admin_roles").select("id, key").in("id", roleIds)
    : { data: [] };
  const roleKeys = (roles ?? []).map((row) => row.key);

  let permissions = new Set<AdminPermissionKey>();

  if (roleIds.length) {
    const { data: permissionRows } = await supabase
      .from("admin_role_permissions")
      .select("permission_key")
      .in("role_id", roleIds);

    permissions = new Set(
      (permissionRows ?? []).map((row) => row.permission_key as AdminPermissionKey)
    );
  }

  if (!permissions.size) {
    permissions = buildLegacyPermissionSet(role);
  }

  return {
    id: String(adminRecord.id),
    username: String(adminRecord.username),
    email: typeof adminRecord.email === "string" ? adminRecord.email : null,
    displayName:
      typeof adminRecord.display_name === "string" ? adminRecord.display_name : null,
    role,
    roleKeys: roleKeys.length ? roleKeys : [role],
    permissions,
    status:
      typeof adminRecord.status === "string"
        ? adminRecord.status
        : adminRecord.is_active === false
          ? "deactivated"
          : "active",
    mfaEnabled: Boolean(adminRecord.mfa_enabled),
  };
}

export function hasPermission(
  context: Pick<AdminContext, "permissions" | "roleKeys"> | null,
  permission: AdminPermissionKey
): boolean {
  if (!context) return false;
  if (context.roleKeys.includes("super_admin")) return true;
  return context.permissions.has(permission);
}

export async function requirePermission(
  permission: AdminPermissionKey,
  options?: { redirectTo?: string }
): Promise<AdminContext> {
  const context = await getAdminContext();
  if (!context) {
    redirect("/login");
  }

  if (!hasPermission(context, permission)) {
    if (options?.redirectTo) {
      redirect(options.redirectTo);
    }
    throw new Error(`Permission denied: ${permission}`);
  }

  return context;
}

export async function requireAnyPermission(
  permissions: AdminPermissionKey[]
): Promise<AdminContext> {
  const context = await getAdminContext();
  if (!context) {
    redirect("/login");
  }

  if (!permissions.some((permission) => hasPermission(context, permission))) {
    throw new Error(`Permission denied: ${permissions.join(", ")}`);
  }

  return context;
}
