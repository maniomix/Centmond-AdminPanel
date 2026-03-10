import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("admin API auth routes enforce same-origin checks", () => {
  const loginRoute = read("app/api/admin/login/route.ts");
  const logoutRoute = read("app/api/admin/logout/route.ts");

  assert.match(loginRoute, /assertSameOriginMutation\(\)/);
  assert.match(logoutRoute, /assertSameOriginMutation\(\)/);
});

test("critical user and subscription mutations use the shared admin mutation wrapper", () => {
  const userActions = read("app/(admin)/admin/users/actions.ts");
  const subscriptionActions = read("app/(admin)/admin/subscriptions/actions.ts");

  assert.match(userActions, /runAdminMutation\(/);
  assert.match(subscriptionActions, /runAdminMutation\(/);
});
