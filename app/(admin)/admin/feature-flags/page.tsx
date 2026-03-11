import { PageHeader } from "@/components/shared/page-header";
import { hasPermission, requirePermission } from "@/lib/admin/permissions";
import { listFeatureFlags } from "@/lib/admin/services/config";
import { FeatureFlagsClient } from "./feature-flags-client";

export const revalidate = 0;

export default async function FeatureFlagsPage() {
  const adminContext = await requirePermission("feature_flags.view");
  const flags = await listFeatureFlags();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Feature Flags"
        description="Operational feature toggles with audited change control and safe rollout metadata."
      />
      <FeatureFlagsClient
        flags={flags}
        canManageFlags={hasPermission(adminContext, "feature_flags.manage")}
      />
    </div>
  );
}
