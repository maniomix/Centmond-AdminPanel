import { PageHeader } from "@/components/shared/page-header";
import { hasPermission, requirePermission } from "@/lib/admin/permissions";
import { listExportJobs } from "@/lib/admin/services/exports";
import { ExportsClient } from "./exports-client";

export const revalidate = 0;

export default async function ExportsPage() {
  const adminContext = await requirePermission("exports.view");
  const jobs = await listExportJobs();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Exports"
        description="Controlled data export center with explicit scope, audit logging, and short-lived downloads."
      />
      <ExportsClient jobs={jobs} canCreateExports={hasPermission(adminContext, "exports.manage")} />
    </div>
  );
}
