import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPermissionSetForRoleKeys,
  SYSTEM_ROLE_PERMISSIONS,
} from "../../lib/admin/constants.ts";

test("finance role permissions include finance management", () => {
  assert.ok(SYSTEM_ROLE_PERMISSIONS.finance_admin.includes("finance.manage"));
  const permissionSet = buildPermissionSetForRoleKeys(["finance_admin"]);
  assert.equal(permissionSet.has("finance.manage"), true);
  assert.equal(permissionSet.has("subscriptions.manage"), true);
});

test("super admins inherit all registered permissions", () => {
  const permissionSet = buildPermissionSetForRoleKeys(["super_admin"]);
  assert.equal(permissionSet.has("approvals.manage"), true);
  assert.equal(permissionSet.has("admins.sessions.manage"), true);
  assert.equal(permissionSet.has("exports.run"), true);
});
