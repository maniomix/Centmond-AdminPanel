import { PageHeader } from "@/components/shared/page-header";
import { hasPermission, requirePermission } from "@/lib/admin/permissions";
import { listInternalSettings } from "@/lib/admin/services/config";
import { InternalSettingsClient } from "./internal-settings-client";

export const revalidate = 0;

export default async function InternalSettingsPage() {
  const adminContext = await requirePermission("internal_settings.view");
  const settings = await listInternalSettings();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Internal Settings"
        description="Operational configuration separated from personal admin settings and guarded by explicit permissions."
      />
      <InternalSettingsClient
        settings={settings}
        canManageSettings={hasPermission(adminContext, "internal_settings.manage")}
      />
    </div>
  );
}
