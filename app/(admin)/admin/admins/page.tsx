import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { parsePage } from "@/lib/table-params";
import { requirePermission } from "@/lib/admin/permissions";
import { AdminsTable } from "@/components/admin/admins/admins-table";

export const revalidate = 0;

type StatusFilter = "all" | "active" | "suspended" | "deactivated";

export default async function AdminsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; status?: string }>;
}) {
  await requirePermission("admins.view");
  const params = await searchParams;
  const page = parsePage(params.page);
  const pageSize = 20;
  const search = params.search?.trim() ?? "";
  const status = (params.status ?? "all") as StatusFilter;
  const supabase = createAdminClient();

  let query = supabase.from("admin_users").select("*", { count: "exact" });
  if (search) {
    query = query.or(
      `username.ilike.%${search}%,email.ilike.%${search}%,display_name.ilike.%${search}%`
    );
  }
  if (status !== "all") {
    query = query.eq("status", status);
  }

  query = query
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  const { data: admins, count } = await query;
  const adminIds = (admins ?? []).map((admin) => admin.id);
  const { data: activeSessions } = adminIds.length
    ? await supabase
        .from("admin_sessions")
        .select("admin_id")
        .in("admin_id", adminIds)
        .is("revoked_at", null)
        .gte("expires_at", new Date().toISOString())
    : { data: [] };

  const sessionCountByAdminId = new Map<string, number>();
  for (const row of activeSessions ?? []) {
    sessionCountByAdminId.set(row.admin_id, (sessionCountByAdminId.get(row.admin_id) ?? 0) + 1);
  }

  const activeCount = (admins ?? []).filter((admin) => admin.status === "active").length;
  const suspendedCount = (admins ?? []).filter((admin) => admin.status === "suspended").length;
  const mfaEnabledCount = (admins ?? []).filter((admin) => admin.mfa_enabled).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Admins"
        description="Manage internal admins, session access, roles and operational security."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Admins in result</p>
            <p className="mt-2 text-2xl font-semibold text-neutral-900">{count ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Active</p>
            <p className="mt-2 text-2xl font-semibold text-neutral-900">{activeCount}</p>
            <p className="mt-1 text-xs text-neutral-500">{suspendedCount} suspended</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-neutral-500">MFA Ready</p>
            <p className="mt-2 text-2xl font-semibold text-neutral-900">{mfaEnabledCount}</p>
            <p className="mt-1 text-xs text-neutral-500">
              Tracking is in place even if MFA rollout is not complete.
            </p>
          </CardContent>
        </Card>
      </div>

      <AdminsTable
        admins={(admins ?? []).map((admin) => ({
          ...admin,
          session_count: sessionCountByAdminId.get(admin.id) ?? 0,
        }))}
        count={count ?? 0}
        page={page}
        pageSize={pageSize}
        search={search}
        status={status}
      />
    </div>
  );
}
