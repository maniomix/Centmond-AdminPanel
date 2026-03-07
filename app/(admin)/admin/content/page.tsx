import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus } from "lucide-react";
import { ContentTable } from "./content-table";

export default async function ContentPage({
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

  let query = supabase.from("content").select("*", { count: "exact" });

  if (search) {
    query = query.or(`title.ilike.%${search}%,slug.ilike.%${search}%`);
  }
  if (status !== "all") {
    query = query.eq("status", status);
  }

  query = query
    .order(sortBy, { ascending: sortOrder === "asc" })
    .range((page - 1) * pageSize, page * pageSize - 1);

  const { data: content, count } = await query;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Content"
        description="Manage published and draft content."
        actions={
          <Button size="sm" asChild>
            <Link href="/admin/content/new">
              <Plus className="h-4 w-4" />
              New content
            </Link>
          </Button>
        }
      />
      <ContentTable
        content={content ?? []}
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
