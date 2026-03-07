import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { ActivityLogsClient } from "./activity-logs-client";

export default async function ActivityLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; status?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page ?? 1);
  const pageSize = 30;
  const search = params.search ?? "";
  const resource = params.status ?? "all";

  const supabase = await createClient();

  let query = supabase.from("activity_logs").select("*", { count: "exact" });

  if (search) {
    query = query.or(`action.ilike.%${search}%,resource_type.ilike.%${search}%`);
  }
  if (resource !== "all") {
    query = query.eq("resource_type", resource);
  }

  query = query
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  const { data: logs, count } = await query;
  const totalPages = Math.ceil((count ?? 0) / pageSize);

  return (
    <div className="space-y-5">
      <PageHeader title="Activity Logs" description="Audit trail of admin actions." />
      <ActivityLogsClient
        search={search}
        resource={resource}
        page={page}
        totalPages={totalPages}
        count={count ?? 0}
        pageSize={pageSize}
      >
        <Card>
          <CardContent className="p-0">
            {!logs?.length ? (
              <div className="px-6 py-12 text-center text-sm text-neutral-400">No activity logs found.</div>
            ) : (
              <div className="divide-y divide-neutral-100">
                {logs.map((log) => (
                  <div key={log.id} className="flex items-start justify-between px-6 py-3.5">
                    <div className="flex items-start gap-3">
                      <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-neutral-300" />
                      <div>
                        <p className="text-sm font-medium text-neutral-900">{log.action}</p>
                        {log.resource_id && (
                          <p className="text-xs text-neutral-500 font-mono">ID: {log.resource_id}</p>
                        )}
                        {log.ip_address && (
                          <p className="text-xs text-neutral-400">IP: {log.ip_address}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge variant="secondary" className="text-xs capitalize">
                        {log.resource_type}
                      </Badge>
                      <span className="text-xs text-neutral-400 whitespace-nowrap">
                        {formatDate(log.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </ActivityLogsClient>
    </div>
  );
}
