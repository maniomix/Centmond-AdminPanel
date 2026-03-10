import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/shared/page-header";
import { parsePage } from "@/lib/table-params";
import { requirePermission } from "@/lib/admin/permissions";
import { AuditLogTable } from "@/components/admin/audit/audit-log-table";

export const revalidate = 0;

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; category?: string }>;
}) {
  await requirePermission("audit_logs.view");
  const params = await searchParams;
  const page = parsePage(params.page);
  const pageSize = 25;
  const search = params.search?.trim() ?? "";
  const category = params.category?.trim() ?? "all";
  const supabase = createAdminClient();

  let query = supabase.from("admin_audit_logs").select("*", { count: "exact" });
  if (category !== "all") {
    query = query.eq("category", category as never);
  }
  if (search) {
    query = query.or(
      `action_type.ilike.%${search}%,target_summary.ilike.%${search}%,target_entity_id.ilike.%${search}%,reason.ilike.%${search}%`
    );
  }

  query = query
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  const { data: logs, count } = await query;
  const actorIds = Array.from(
    new Set((logs ?? []).map((log) => log.actor_admin_id).filter(Boolean))
  ) as string[];

  const { data: admins } = actorIds.length
    ? await supabase.from("admin_users").select("id, username, display_name").in("id", actorIds)
    : { data: [] };
  const adminMap = new Map(
    (admins ?? []).map((admin) => [admin.id, admin.display_name ?? admin.username])
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit Logs"
        description="Trace sensitive admin actions across authentication, user operations, billing, and security."
      />
      <AuditLogTable
        logs={(logs ?? []).map((log) => ({
          ...log,
          actorLabel: log.actor_admin_id
            ? adminMap.get(log.actor_admin_id) ?? log.actor_admin_id
            : "System / unknown actor",
        }))}
        count={count ?? 0}
        page={page}
        pageSize={pageSize}
        search={search}
        category={category}
      />
    </div>
  );
}
