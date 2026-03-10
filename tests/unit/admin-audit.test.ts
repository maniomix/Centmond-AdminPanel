import test from "node:test";
import assert from "node:assert/strict";

import { classifyAuditWriteFailure } from "../../lib/admin/audit-utils.ts";

test("required audit failures are fail-closed", () => {
  assert.equal(
    classifyAuditWriteFailure("Could not find the table 'public.admin_audit_logs'", {
      required: true,
    }),
    "throw"
  );
});

test("missing optional audit table failures are skipped", () => {
  assert.equal(
    classifyAuditWriteFailure("Could not find the table 'public.admin_audit_logs' in the schema cache"),
    "skip"
  );
});

test("generic optional audit failures only warn", () => {
  assert.equal(classifyAuditWriteFailure("permission denied"), "warn");
});
