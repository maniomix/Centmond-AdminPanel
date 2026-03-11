import test from "node:test";
import assert from "node:assert/strict";

import { isMissingBulkJobsTableError } from "../../lib/admin/bulk-jobs-utils.ts";

test("detects schema cache errors for the bulk_jobs table", () => {
  assert.equal(
    isMissingBulkJobsTableError("Could not find the table 'public.bulk_jobs' in the schema cache"),
    true
  );
});

test("detects relation errors for the bulk_jobs table", () => {
  assert.equal(
    isMissingBulkJobsTableError('relation "public.bulk_jobs" does not exist'),
    true
  );
});

test("ignores unrelated errors", () => {
  assert.equal(isMissingBulkJobsTableError("permission denied"), false);
});
