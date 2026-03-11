import {
  ADMIN_PERMISSION_FALLBACKS,
  type AdminPermissionKey,
} from "./constants.ts";

export function hasAdminPermission(
  context: Pick<{ permissions: Set<AdminPermissionKey>; roleKeys: string[] }, "permissions" | "roleKeys"> | null,
  permission: AdminPermissionKey
): boolean {
  if (!context) return false;
  if (context.roleKeys.includes("super_admin")) return true;
  if (context.permissions.has(permission)) return true;

  return (ADMIN_PERMISSION_FALLBACKS[permission] ?? []).some((fallback) =>
    context.permissions.has(fallback)
  );
}
