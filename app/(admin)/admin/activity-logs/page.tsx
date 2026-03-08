import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { ActivityLogsClient } from "./activity-logs-client";
import { parsePage } from "@/lib/table-params";

export default async function ActivityLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; status?: string }>;
}) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const pageSize = 30;
  const search = params.search ?? "";
  const eventName = params.status ?? "all";

  const supabase = createAdminClient();

  const { data: optionRows } = await supabase
    .from("events")
    .select("event_name")
    .order("event_name", { ascending: true })
    .limit(1000);

  const eventOptions = Array.from(
    new Set((optionRows ?? []).map((row) => row.event_name).filter(Boolean))
  )
    .map(String)
    .sort((a, b) => a.localeCompare(b));

  let query = supabase.from("events").select("*", { count: "exact" });

  if (search) {
    query = query.ilike("event_name", `%${search}%`);
  }
  if (eventName !== "all") {
    query = query.eq("event_name", eventName);
  }

  query = query
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  const { data: events, count } = await query;
  const totalPages = Math.ceil((count ?? 0) / pageSize);

  const userIds = Array.from(
    new Set((events ?? []).map((event) => event.user_id).filter(Boolean))
  ) as string[];

  const { data: users } = userIds.length
    ? await supabase
        .from("users")
        .select("id, email, display_name")
        .in("id", userIds)
    : { data: [] };

  const usersById = new Map((users ?? []).map((user) => [user.id, user]));

  return (
    <div className="space-y-5">
      <PageHeader title="Activity" description="Live event stream from your application." />
      <ActivityLogsClient
        search={search}
        eventName={eventName}
        eventOptions={eventOptions}
        page={page}
        totalPages={totalPages}
        count={count ?? 0}
        pageSize={pageSize}
      >
        <Card>
          <CardContent className="p-0">
            {!events?.length ? (
              <div className="px-6 py-12 text-center text-sm text-neutral-400">
                No events found.
              </div>
            ) : (
              <div className="divide-y divide-neutral-100">
                {events.map((event) => {
                  const user = event.user_id
                    ? usersById.get(event.user_id) ?? null
                    : null;
                  return (
                    <div key={event.id} className="flex items-start justify-between px-6 py-3.5">
                      <div className="flex items-start gap-3">
                        <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-neutral-300" />
                        <div>
                          <p className="text-sm font-medium text-neutral-900">{event.event_name}</p>
                          <p className="text-xs text-neutral-500">
                            {user ? user.display_name ?? user.email : "Unknown user"}
                          </p>
                          {event.event_properties && (
                            <p className="text-xs text-neutral-400 font-mono">
                              {JSON.stringify(event.event_properties).slice(0, 120)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <Badge variant="secondary" className="text-xs">
                          {user?.email ?? "-"}
                        </Badge>
                        <span className="text-xs text-neutral-400 whitespace-nowrap">
                          {formatDate(event.created_at)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </ActivityLogsClient>
    </div>
  );
}
