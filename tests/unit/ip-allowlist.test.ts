import test from "node:test";
import assert from "node:assert/strict";

import { isIpAllowed } from "../../lib/admin/ip-allowlist.ts";

test("ip allowlist allows all traffic when no allowlist is configured", () => {
  assert.equal(isIpAllowed("203.0.113.10", []), true);
  assert.equal(isIpAllowed(null, []), true);
});

test("ip allowlist accepts exact matches and CIDR ranges", () => {
  assert.equal(isIpAllowed("203.0.113.10", ["203.0.113.10"]), true);
  assert.equal(isIpAllowed("203.0.113.11", ["203.0.113.0/24"]), true);
  assert.equal(isIpAllowed("203.0.114.11", ["203.0.113.0/24"]), false);
});

test("ip allowlist rejects invalid entries and missing client ip", () => {
  assert.equal(isIpAllowed("203.0.113.10", ["not-an-ip"]), false);
  assert.equal(isIpAllowed(null, ["203.0.113.10"]), false);
});
