import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { OrdersTable } from "./orders-table";

export default async function OrdersPage({
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

  let query = supabase.from("orders").select("*", { count: "exact" });

  if (search) {
    query = query.ilike("order_number", `%${search}%`);
  }
  if (status !== "all") {
    query = query.eq("status", status);
  }

  query = query
    .order(sortBy, { ascending: sortOrder === "asc" })
    .range((page - 1) * pageSize, page * pageSize - 1);

  const { data: orders, count } = await query;

  return (
    <div className="space-y-5">
      <PageHeader title="Orders" description="Manage customer orders." />
      <OrdersTable
        orders={orders ?? []}
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
