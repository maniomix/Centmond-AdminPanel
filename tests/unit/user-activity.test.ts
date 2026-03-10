import test from "node:test";
import assert from "node:assert/strict";

import { buildOnlineUserIds } from "../../lib/user-activity.ts";

test("online presence requires a recent open session", () => {
  const now = Date.now();

  const onlineUserIds = buildOnlineUserIds({
    sessionStateRows: [
      {
        user_id: "user-1",
        session_id: "session-1",
        event_name: "session_start",
        created_at: new Date(now - 5_000).toISOString(),
      },
    ],
    recentEventRows: [],
    recentWindowSeconds: 12,
    nowMs: now,
  });

  assert.deepEqual(onlineUserIds, ["user-1"]);
});

test("closed sessions do not count as online even with later generic events", () => {
  const now = Date.now();

  const onlineUserIds = buildOnlineUserIds({
    sessionStateRows: [
      {
        user_id: "user-2",
        session_id: "session-2",
        event_name: "session_end",
        created_at: new Date(now - 3_000).toISOString(),
      },
    ],
    recentEventRows: [
      {
        user_id: "user-2",
        session_id: "session-2",
        event_name: "feature_usage",
        created_at: new Date(now - 2_000).toISOString(),
      },
    ],
    recentWindowSeconds: 12,
    nowMs: now,
  });

  assert.deepEqual(onlineUserIds, []);
});

test("generic recent events without session context do not imply online presence", () => {
  const now = Date.now();

  const onlineUserIds = buildOnlineUserIds({
    sessionStateRows: [],
    recentEventRows: [
      {
        user_id: "user-3",
        event_name: "feature_usage",
        created_at: new Date(now - 2_000).toISOString(),
      },
    ],
    recentWindowSeconds: 12,
    nowMs: now,
  });

  assert.deepEqual(onlineUserIds, []);
});
