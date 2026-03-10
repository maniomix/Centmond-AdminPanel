import { Badge } from "@/components/ui/badge";
import { getRoleLabel } from "@/lib/admin/constants";

const roleVariant: Record<string, "default" | "secondary" | "info" | "warning"> = {
  super_admin: "default",
  operations_admin: "info",
  support_admin: "secondary",
  finance_admin: "warning",
  moderation_admin: "secondary",
  analyst: "secondary",
  admin: "info",
  viewer: "secondary",
};

export function AdminRoleBadge({ role }: { role: string }) {
  return (
    <Badge variant={roleVariant[role] ?? "secondary"} className="capitalize">
      {getRoleLabel(role)}
    </Badge>
  );
}
