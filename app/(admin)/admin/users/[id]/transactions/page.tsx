export const revalidate = 0;

import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TransactionsTable } from "./transactions-table";
import type { SubscriptionRow, TransactionRow } from "@/types";
import { parsePage, parseSortBy, parseSortOrder } from "@/lib/table-params";
import { formatRawEuro, fromStoredMoney } from "@/lib/money";

const TRANSACTION_SORT_COLUMNS = [
  "date",
  "amount",
  "type",
  "category",
  "created_at",
] as const;

const planVariant: Record<string, "default" | "secondary" | "success"> = {
  free: "secondary",
  monthly: "default",
  yearly: "success",
};

export default async function UserTransactionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    page?: string;
    search?: string;
    type?: string;
    category?: string;
    sortBy?: string;
    sortOrder?: string;
  }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const pageSize = 20;
  const search = sp.search ?? "";
  const type = sp.type ?? "all";
  const category = sp.category ?? "all";
  const sortBy = parseSortBy(sp.sortBy, TRANSACTION_SORT_COLUMNS, "date");
  const sortOrder = parseSortOrder(sp.sortOrder);

  const supabase = createAdminClient();

  const { data: user } = await supabase
    .from("users")
    .select("id, email, display_name, created_at, last_active_at, is_email_verified")
    .eq("id", id)
    .single();

  if (!user) notFound();

  const [{ data: subscriptionData }, { data: categoryRows }, { data: summaryRows }] =
    await Promise.all([
      supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", id)
        .order("updated_at", { ascending: false })
        .limit(1),
      supabase
        .from("transactions")
        .select("category")
        .eq("user_id", id)
        .eq("is_deleted", false),
      supabase
        .from("transactions")
        .select("amount, type")
        .eq("user_id", id)
        .eq("is_deleted", false),
    ]);

  let query = supabase
    .from("transactions")
    .select("*", { count: "exact" })
    .eq("user_id", id)
    .eq("is_deleted", false);

  if (search) {
    query = query.or(`category.ilike.%${search}%,note.ilike.%${search}%`);
  }
  if (type !== "all") {
    query = query.eq("type", type as TransactionRow["type"]);
  }
  if (category !== "all") {
    query = query.eq("category", category);
  }

  query = query
    .order(sortBy, { ascending: sortOrder === "asc" })
    .range((page - 1) * pageSize, page * pageSize - 1);

  const { data: transactions, count } = await query;
  const subscription = (subscriptionData?.[0] ?? null) as SubscriptionRow | null;

  const categories = Array.from(
    new Set((categoryRows ?? []).map((row) => row.category).filter(Boolean))
  )
    .map(String)
    .sort((a, b) => a.localeCompare(b));

  const totals = (summaryRows ?? []).reduce(
    (acc, row) => {
      const amount = fromStoredMoney(Number(row.amount ?? 0));
      if (row.type === "income") acc.income += amount;
      else acc.expense += amount;
      return acc;
    },
    { income: 0, expense: 0 }
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="h-8 w-8">
          <Link href={`/admin/users/${id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-neutral-900 truncate">
              {(user.display_name ?? "Unnamed User").trim()} - Transactions
            </h1>
            {subscription && (
              <Badge
                variant={planVariant[subscription.plan] ?? "secondary"}
                className="capitalize text-xs shrink-0"
              >
                {subscription.plan}
              </Badge>
            )}
          </div>
          <p className="text-sm text-neutral-500">{user.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wider text-neutral-500">Income</p>
          <p className="mt-1 text-xl font-semibold text-green-600">
            +{formatRawEuro(totals.income)} €
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wider text-neutral-500">Expense</p>
          <p className="mt-1 text-xl font-semibold text-red-600">
            -{formatRawEuro(totals.expense)} €
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wider text-neutral-500">Net</p>
          <p
            className={`mt-1 text-xl font-semibold ${
              totals.income - totals.expense >= 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            {(totals.income - totals.expense >= 0 ? "+" : "") +
              formatRawEuro(totals.income - totals.expense)}{" "}
            €
          </p>
        </div>
      </div>

      <TransactionsTable
        transactions={transactions ?? []}
        count={count ?? 0}
        userId={id}
        page={page}
        pageSize={pageSize}
        search={search}
        type={type}
        category={category}
        categories={categories}
        sortBy={sortBy}
        sortOrder={sortOrder}
      />
    </div>
  );
}
