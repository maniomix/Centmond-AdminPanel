export const ADMIN_PERMISSION_KEYS = [
  "dashboard.view",
  "users.view",
  "users.edit",
  "users.suspend",
  "users.ban",
  "users.reactivate",
  "users.soft_delete",
  "users.sessions.manage",
  "user_sessions.view",
  "user_sessions.manage",
  "users.impersonate",
  "users.export",
  "subscriptions.view",
  "subscriptions.manage",
  "billing.view",
  "billing.refunds.issue",
  "finance.view",
  "finance.manage",
  "finance.notes.manage",
  "support.view",
  "support.notes.manage",
  "support_handoffs.manage",
  "tags.manage",
  "flags.manage",
  "risk.view",
  "risk.manage",
  "reviews.manage",
  "review_queue.manage",
  "audit_logs.view",
  "activity_logs.view",
  "admins.view",
  "admins.create",
  "admins.edit",
  "admins.deactivate",
  "admins.sessions.manage",
  "roles.assign",
  "permissions.manage",
  "orders.view",
  "orders.manage",
  "content.manage",
  "saved_views.manage",
  "bulk_actions.run",
  "feature_flags.view",
  "feature_flags.manage",
  "internal_settings.view",
  "internal_settings.manage",
  "approvals.manage",
  "settings.manage",
  "exports.view",
  "exports.manage",
  "exports.run",
] as const;

export type AdminPermissionKey = (typeof ADMIN_PERMISSION_KEYS)[number];

export const SYSTEM_ADMIN_ROLE_KEYS = [
  "super_admin",
  "operations_admin",
  "support_admin",
  "finance_admin",
  "moderation_admin",
  "analyst",
  "admin",
  "viewer",
] as const;

export type AdminRole =
  | "super_admin"
  | "operations_admin"
  | "support_admin"
  | "finance_admin"
  | "moderation_admin"
  | "analyst"
  | "admin"
  | "viewer";

export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: "Super Admin",
  operations_admin: "Operations Admin",
  support_admin: "Support Admin",
  finance_admin: "Finance Admin",
  moderation_admin: "Moderation Admin",
  analyst: "Analyst",
  admin: "Admin",
  viewer: "Viewer",
};

export const LEGACY_ROLE_TO_SYSTEM_ROLE: Record<AdminRole, AdminRole> = {
  super_admin: "super_admin",
  operations_admin: "operations_admin",
  support_admin: "support_admin",
  finance_admin: "finance_admin",
  moderation_admin: "moderation_admin",
  analyst: "analyst",
  admin: "operations_admin",
  viewer: "analyst",
};

export const SYSTEM_ROLE_PERMISSIONS: Record<AdminRole, AdminPermissionKey[]> = {
  super_admin: [...ADMIN_PERMISSION_KEYS],
  operations_admin: [
    "dashboard.view",
    "users.view",
    "users.edit",
    "users.suspend",
    "users.reactivate",
    "users.sessions.manage",
    "user_sessions.view",
    "user_sessions.manage",
    "subscriptions.view",
    "subscriptions.manage",
    "finance.view",
    "finance.manage",
    "support.view",
    "support.notes.manage",
    "support_handoffs.manage",
    "tags.manage",
    "flags.manage",
    "risk.view",
    "reviews.manage",
    "review_queue.manage",
    "audit_logs.view",
    "activity_logs.view",
    "admins.view",
    "admins.create",
    "admins.edit",
    "admins.deactivate",
    "admins.sessions.manage",
    "roles.assign",
    "permissions.manage",
    "orders.view",
    "orders.manage",
    "content.manage",
    "saved_views.manage",
    "bulk_actions.run",
    "feature_flags.view",
    "feature_flags.manage",
    "internal_settings.view",
    "internal_settings.manage",
    "approvals.manage",
    "settings.manage",
    "exports.view",
    "exports.manage",
    "exports.run",
  ],
  support_admin: [
    "dashboard.view",
    "users.view",
    "users.edit",
    "users.sessions.manage",
    "user_sessions.view",
    "user_sessions.manage",
    "support.view",
    "support.notes.manage",
    "support_handoffs.manage",
    "tags.manage",
    "flags.manage",
    "activity_logs.view",
    "saved_views.manage",
  ],
  finance_admin: [
    "dashboard.view",
    "users.view",
    "subscriptions.view",
    "subscriptions.manage",
    "billing.view",
    "billing.refunds.issue",
    "finance.view",
    "finance.manage",
    "finance.notes.manage",
    "orders.view",
    "orders.manage",
    "audit_logs.view",
    "activity_logs.view",
    "exports.view",
    "exports.manage",
    "exports.run",
    "saved_views.manage",
  ],
  moderation_admin: [
    "dashboard.view",
    "users.view",
    "users.suspend",
    "users.ban",
    "users.reactivate",
    "support.notes.manage",
    "tags.manage",
    "flags.manage",
    "risk.view",
    "risk.manage",
    "reviews.manage",
    "review_queue.manage",
    "activity_logs.view",
    "saved_views.manage",
  ],
  analyst: [
    "dashboard.view",
    "users.view",
    "subscriptions.view",
    "billing.view",
    "finance.view",
    "support.view",
    "risk.view",
    "audit_logs.view",
    "activity_logs.view",
    "orders.view",
    "saved_views.manage",
  ],
  admin: [
    "dashboard.view",
    "users.view",
    "users.edit",
    "users.suspend",
    "users.reactivate",
    "users.sessions.manage",
    "user_sessions.view",
    "user_sessions.manage",
    "subscriptions.view",
    "subscriptions.manage",
    "support.view",
    "support.notes.manage",
    "support_handoffs.manage",
    "tags.manage",
    "flags.manage",
    "audit_logs.view",
    "activity_logs.view",
    "orders.view",
    "orders.manage",
    "content.manage",
    "saved_views.manage",
    "settings.manage",
  ],
  viewer: ["dashboard.view", "users.view", "activity_logs.view"],
};

export const DEFAULT_SYSTEM_ROLE_ORDER: AdminRole[] = [
  "super_admin",
  "operations_admin",
  "support_admin",
  "finance_admin",
  "moderation_admin",
  "analyst",
];

export function getAssignableRoles(): AdminRole[] {
  return [...DEFAULT_SYSTEM_ROLE_ORDER];
}

export const ADMIN_PERMISSION_FALLBACKS: Partial<
  Record<AdminPermissionKey, readonly AdminPermissionKey[]>
> = {
  "user_sessions.view": ["user_sessions.manage", "users.sessions.manage"],
  "user_sessions.manage": ["users.sessions.manage"],
  "finance.view": ["finance.manage", "billing.view"],
  "review_queue.manage": ["reviews.manage"],
  "support_handoffs.manage": ["support.notes.manage", "finance.notes.manage"],
  "feature_flags.view": ["feature_flags.manage"],
  "internal_settings.view": ["internal_settings.manage"],
  "exports.view": ["exports.manage", "exports.run"],
  "exports.manage": ["exports.run"],
};

export function buildPermissionSetForRoleKeys(
  roleKeys: string[],
  fallbackRole?: AdminRole
): Set<AdminPermissionKey> {
  const keys = roleKeys.length ? roleKeys : fallbackRole ? [fallbackRole] : [];
  const permissions = new Set<AdminPermissionKey>();

  for (const key of keys) {
    const normalizedRole = LEGACY_ROLE_TO_SYSTEM_ROLE[key as AdminRole] ?? (key as AdminRole);
    for (const permission of SYSTEM_ROLE_PERMISSIONS[normalizedRole] ?? []) {
      permissions.add(permission);
    }
  }

  return permissions;
}

export function isAdminRole(value: string): value is AdminRole {
  return (SYSTEM_ADMIN_ROLE_KEYS as readonly string[]).includes(value);
}

export function getRoleLabel(role: string): string {
  return ADMIN_ROLE_LABELS[role as AdminRole] ?? role.replace(/_/g, " ");
}
