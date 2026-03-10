import test from "node:test";
import assert from "node:assert/strict";

import { isRateLimitExceeded } from "../../lib/admin/login-utils.ts";

test("rate limiting triggers on identifier or ip failure thresholds", () => {
  assert.equal(isRateLimitExceeded(10, 0, 10), true);
  assert.equal(isRateLimitExceeded(0, 10, 10), true);
  assert.equal(isRateLimitExceeded(9, 9, 10), false);
});
