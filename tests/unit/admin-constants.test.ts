import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPermissionSetForRoleKeys,
  SYSTEM_ROLE_PERMISSIONS,
} from "../../lib/admin/constants.ts";
import { hasAdminPermission } from "../../lib/admin/permission-utils.ts";

test("finance role permissions include finance management", () => {
  assert.ok(SYSTEM_ROLE_PERMISSIONS.finance_admin.includes("finance.manage"));
  assert.ok(SYSTEM_ROLE_PERMISSIONS.finance_admin.includes("finance.view"));
  const permissionSet = buildPermissionSetForRoleKeys(["finance_admin"]);
  assert.equal(permissionSet.has("finance.manage"), true);
  assert.equal(permissionSet.has("finance.view"), true);
  assert.equal(permissionSet.has("subscriptions.manage"), true);
});

test("super admins inherit all registered permissions", () => {
  const permissionSet = buildPermissionSetForRoleKeys(["super_admin"]);
  assert.equal(permissionSet.has("approvals.manage"), true);
  assert.equal(permissionSet.has("admins.sessions.manage"), true);
  assert.equal(permissionSet.has("exports.manage"), true);
  assert.equal(permissionSet.has("exports.run"), true);
});

test("permission fallbacks preserve legacy role grants during alignment", () => {
  const context = {
    roleKeys: ["finance_admin"],
    permissions: new Set([
      "exports.run",
      "users.sessions.manage",
      "reviews.manage",
    ] as const),
  };

  assert.equal(hasAdminPermission(context, "exports.view"), true);
  assert.equal(hasAdminPermission(context, "exports.manage"), true);
  assert.equal(hasAdminPermission(context, "user_sessions.view"), true);
  assert.equal(hasAdminPermission(context, "user_sessions.manage"), true);
  assert.equal(hasAdminPermission(context, "review_queue.manage"), true);
});
