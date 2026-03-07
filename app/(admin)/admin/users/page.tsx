import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { UsersTable } from "./users-table";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; status?: string; sortBy?: string; sortOrder?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page ?? 1);
  const pageSize = 20;
  const search = params.search ?? "";
  const status = params.status ?? "all";
  const sortBy = params.sortBy ?? "created_at";
  const sortOrder = (params.sortOrder ?? "desc") as "asc" | "desc";

  const supabase = await createClient();

  let query = supabase
    .from("users")
    .select("*", { count: "exact" });

  if (search) {
    query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
  }
  if (status !== "all") {
    query = query.eq("status", status);
  }

  query = query
    .order(sortBy, { ascending: sortOrder === "asc" })
    .range((page - 1) * pageSize, page * pageSize - 1);

  const { data: users, count } = await query;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Users"
        description="Manage all registered users."
      />
      <UsersTable
        users={users ?? []}
        count={count ?? 0}
        page={page}
        pageSize={pageSize}
        search={search}
        status={status}
        sortBy={sortBy}
        sortOrder={sortOrder}
      />
    </div>
  );
}
