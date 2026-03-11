import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("phase 2 route modules enforce permissions server-side", () => {
  const financePage = read("app/(admin)/admin/finance/page.tsx");
  const exportsPage = read("app/(admin)/admin/exports/page.tsx");
  const featureFlagsPage = read("app/(admin)/admin/feature-flags/page.tsx");
  const internalSettingsPage = read("app/(admin)/admin/internal-settings/page.tsx");

  assert.match(financePage, /requirePermission\("finance\.view"\)/);
  assert.match(exportsPage, /requirePermission\("exports\.view"\)/);
  assert.match(featureFlagsPage, /requirePermission\("feature_flags\.view"\)/);
  assert.match(internalSettingsPage, /requirePermission\("internal_settings\.view"\)/);
});

test("phase 2 data access uses real security tables and job-backed operations", () => {
  const userDetailPage = read("app/(admin)/admin/users/[id]/page.tsx");
  const usersActions = read("app/(admin)/admin/users/actions.ts");
  const exportsRoute = read("app/api/admin/exports/[id]/route.ts");

  assert.match(userDetailPage, /listUserSecurityData\(/);
  assert.match(userDetailPage, /SupportHandoffsPanel/);
  assert.match(usersActions, /createBulkJob\(/);
  assert.match(usersActions, /updateBulkJobState\(/);
  assert.match(exportsRoute, /hasPermission\(admin, "exports\.manage"\)/);
});
