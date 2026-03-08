import { createAdminClient } from "@/lib/supabase/admin";
import { parsePage, parseSortBy, parseSortOrder } from "@/lib/table-params";
import { PageHeader } from "@/components/shared/page-header";
import { UsersTable } from "./users-table";

export const revalidate = 0;

const USER_SORT_COLUMNS = [
  "display_name",
  "email",
  "is_email_verified",
  "created_at",
  "last_active_at",
] as const;

type VerificationFilter = "all" | "verified" | "unverified";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    search?: string;
    verification?: string;
    sortBy?: string;
    sortOrder?: string;
  }>;
}) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const pageSize = 20;
  const search = params.search?.trim() ?? "";
  const verification = (params.verification ?? "all") as VerificationFilter;
  const sortBy = parseSortBy(params.sortBy, USER_SORT_COLUMNS, "created_at");
  const sortOrder = parseSortOrder(params.sortOrder);

  const supabase = createAdminClient();

  let query = supabase.from("users").select("*", { count: "exact" });

  if (search) {
    query = query.or(`email.ilike.%${search}%,display_name.ilike.%${search}%`);
  }

  if (verification === "verified") {
    query = query.eq("is_email_verified", true);
  } else if (verification === "unverified") {
    query = query.or("is_email_verified.is.false,is_email_verified.is.null");
  }

  query = query
    .order(sortBy, { ascending: sortOrder === "asc", nullsFirst: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  const { data: users, count } = await query;
  const userIds = (users ?? []).map((user) => user.id);

  const { data: subscriptions } = userIds.length
    ? await supabase
        .from("subscriptions")
        .select("user_id, plan, status, updated_at")
        .in("user_id", userIds)
        .order("updated_at", { ascending: false })
    : { data: [] };

  const subscriptionByUserId = new Map<
    string,
    { plan: string; status: string; updated_at: string }
  >();

  for (const row of subscriptions ?? []) {
    if (!subscriptionByUserId.has(row.user_id)) {
      subscriptionByUserId.set(row.user_id, {
        plan: row.plan,
        status: row.status,
        updated_at: row.updated_at,
      });
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Users" description="Manage users, verification and subscription access." />
      <UsersTable
        users={users ?? []}
        count={count ?? 0}
        page={page}
        pageSize={pageSize}
        search={search}
        verification={verification}
        sortBy={sortBy}
        sortOrder={sortOrder}
        subscriptionByUserId={Object.fromEntries(subscriptionByUserId)}
      />
    </div>
  );
}
