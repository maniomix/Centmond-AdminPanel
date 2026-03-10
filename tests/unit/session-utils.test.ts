import test from "node:test";
import assert from "node:assert/strict";

import { hasRecentSensitiveAuthTimestamp } from "../../lib/admin/session-utils.ts";

test("recent sensitive auth timestamps inside the window are accepted", () => {
  const recentTimestamp = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  assert.equal(hasRecentSensitiveAuthTimestamp(recentTimestamp, 5), true);
});

test("stale or invalid sensitive auth timestamps are rejected", () => {
  const staleTimestamp = new Date(Date.now() - 20 * 60 * 1000).toISOString();
  assert.equal(hasRecentSensitiveAuthTimestamp(staleTimestamp, 5), false);
  assert.equal(hasRecentSensitiveAuthTimestamp("not-a-date", 5), false);
  assert.equal(hasRecentSensitiveAuthTimestamp(null, 5), false);
});
