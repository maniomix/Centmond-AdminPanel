import { createAdminClient } from "@/lib/supabase/admin";
import { parsePage, parseSortBy, parseSortOrder } from "@/lib/table-params";
import { PageHeader } from "@/components/shared/page-header";
import { SubscriptionsTable } from "./subscriptions-table";

export const revalidate = 0;

const SUBSCRIPTION_SORT_COLUMNS = [
  "updated_at",
  "created_at",
  "plan",
  "status",
  "platform",
  "current_period_end",
] as const;

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    search?: string;
    userId?: string;
    status?: string;
    plan?: string;
    sortBy?: string;
    sortOrder?: string;
  }>;
}) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const pageSize = 20;
  const search = params.search?.trim() ?? "";
  const userId = params.userId?.trim() ?? "";
  const status = params.status ?? "all";
  const plan = params.plan ?? "all";
  const sortBy = parseSortBy(params.sortBy, SUBSCRIPTION_SORT_COLUMNS, "updated_at");
  const sortOrder = parseSortOrder(params.sortOrder);

  const supabase = createAdminClient();

  const { data: optionRows } = await supabase
    .from("subscriptions")
    .select("plan, status")
    .limit(2000);

  const planOptions = Array.from(
    new Set((optionRows ?? []).map((row) => row.plan).filter(Boolean))
  )
    .map(String)
    .sort((a, b) => a.localeCompare(b));

  const statusOptions = Array.from(
    new Set((optionRows ?? []).map((row) => row.status).filter(Boolean))
  )
    .map(String)
    .sort((a, b) => a.localeCompare(b));

  let userFilterIds: string[] | null = null;
  if (userId) {
    userFilterIds = [userId];
  }

  if (search) {
    const { data: matchedUsers } = await supabase
      .from("users")
      .select("id")
      .or(`email.ilike.%${search}%,display_name.ilike.%${search}%`)
      .limit(200);

    const ids = (matchedUsers ?? []).map((row) => row.id);
    if (userFilterIds) {
      userFilterIds = userFilterIds.filter((id) => ids.includes(id));
    } else {
      userFilterIds = ids;
    }
  }

  if (userFilterIds && userFilterIds.length === 0) {
    return (
      <div className="space-y-5">
        <PageHeader
          title="Subscriptions"
          description="Manage user plans, status and billing periods."
        />
        <SubscriptionsTable
          subscriptions={[]}
          usersById={{}}
          count={0}
          page={page}
          pageSize={pageSize}
          search={search}
          userId={userId}
          status={status}
          plan={plan}
          sortBy={sortBy}
          sortOrder={sortOrder}
          planOptions={planOptions}
          statusOptions={statusOptions}
        />
      </div>
    );
  }

  let query = supabase.from("subscriptions").select("*", { count: "exact" });

  if (userFilterIds) {
    query = query.in("user_id", userFilterIds);
  }
  if (status !== "all") {
    query = query.eq("status", status);
  }
  if (plan !== "all") {
    query = query.eq("plan", plan);
  }

  query = query
    .order(sortBy, { ascending: sortOrder === "asc", nullsFirst: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  const { data: subscriptions, count } = await query;
  const userIds = (subscriptions ?? []).map((row) => row.user_id);

  const { data: users } = userIds.length
    ? await supabase
        .from("users")
        .select("id, email, display_name")
        .in("id", userIds)
    : { data: [] };

  const usersById = Object.fromEntries(
    (users ?? []).map((row) => [row.id, row])
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Subscriptions"
        description="Manage user plans, status and billing periods."
      />
      <SubscriptionsTable
        subscriptions={subscriptions ?? []}
        usersById={usersById}
        count={count ?? 0}
        page={page}
        pageSize={pageSize}
        search={search}
        userId={userId}
        status={status}
        plan={plan}
        sortBy={sortBy}
        sortOrder={sortOrder}
        planOptions={planOptions}
        statusOptions={statusOptions}
      />
    </div>
  );
}
