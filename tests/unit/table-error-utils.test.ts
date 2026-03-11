import test from "node:test";
import assert from "node:assert/strict";

import { isMissingTableError } from "../../lib/admin/table-error-utils.ts";

test("detects schema cache errors for a requested table", () => {
  assert.equal(
    isMissingTableError("Could not find the table 'public.export_jobs' in the schema cache", "export_jobs"),
    true
  );
});

test("detects relation missing errors for a requested table", () => {
  assert.equal(
    isMissingTableError('relation "public.feature_flags" does not exist', "feature_flags"),
    true
  );
});

test("ignores unrelated table errors", () => {
  assert.equal(
    isMissingTableError('relation "public.export_jobs" does not exist', "internal_settings"),
    false
  );
});
