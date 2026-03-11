import { isMissingTableError } from "./table-error-utils.ts";

export function isMissingBulkJobsTableError(message: string): boolean {
  return isMissingTableError(message, "bulk_jobs");
}
