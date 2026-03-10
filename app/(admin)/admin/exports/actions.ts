"use server";

import { runAdminMutation, toAdminActionError } from "@/lib/admin/mutations";
import { exportJobSchema } from "@/lib/admin/schemas/phase2";
import { createAndRunExportJob } from "@/lib/admin/services/exports";

export async function requestExportJobAction(values: unknown) {
  let parsed: ReturnType<typeof exportJobSchema.parse>;
  try {
    parsed = exportJobSchema.parse(values);
  } catch {
    return { error: "Invalid export request" };
  }

  try {
    return await runAdminMutation({
      permission: "exports.run",
      requireRecentAuth: true,
      execute: async (actor) => {
        const job = await createAndRunExportJob({
          createdByAdminId: actor.id,
          exportType: parsed.exportType,
          targetScope: parsed.targetScope,
          format: parsed.format,
          reason: parsed.reason,
          filters: parsed.filters,
        });

        return {
          value: job,
          audit: {
            actionType: "export.job_created",
            category: "export",
            severity: "warning",
            targetEntityType: "export_job",
            targetEntityId: job.jobId,
            targetSummary: parsed.targetScope,
            reason: parsed.reason,
            afterState: {
              exportType: parsed.exportType,
              targetScope: parsed.targetScope,
              format: parsed.format,
              rowCount: job.rowCount,
            },
          },
          revalidatePaths: ["/admin/exports"],
        };
      },
    });
  } catch (error) {
    return toAdminActionError(error, "Failed to create export job");
  }
}
