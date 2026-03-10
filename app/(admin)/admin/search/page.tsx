import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requirePermission } from "@/lib/admin/permissions";
import { GlobalSearchForm } from "@/components/admin/search/global-search-form";
import { auditWithCurrentAdmin } from "@/lib/admin/audit";

export const revalidate = 0;

export default async function AdminSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requirePermission("users.view");
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const looksLikeUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      query
    );
  const supabase = createAdminClient();

  const [users, admins, subscriptions, transactions] = query
    ? await Promise.all([
        (() => {
          const usersQuery = supabase
            .from("users")
            .select("id, email, display_name, username, status")
            .limit(8);
          return looksLikeUuid
            ? usersQuery.eq("id", query)
            : usersQuery.or(
                `email.ilike.%${query}%,display_name.ilike.%${query}%,username.ilike.%${query}%`
              );
        })(),
        (() => {
          const adminsQuery = supabase
            .from("admin_users")
            .select("id, username, email, display_name, role, status")
            .limit(8);
          return looksLikeUuid
            ? adminsQuery.eq("id", query)
            : adminsQuery.or(
                `username.ilike.%${query}%,email.ilike.%${query}%,display_name.ilike.%${query}%`
              );
        })(),
        (() => {
          const subscriptionsQuery = supabase
            .from("subscriptions")
            .select("id, user_id, plan, status, stripe_customer_id, stripe_subscription_id")
            .limit(8);
          return looksLikeUuid
            ? subscriptionsQuery.eq("id", query)
            : subscriptionsQuery.or(
                `stripe_customer_id.ilike.%${query}%,stripe_subscription_id.ilike.%${query}%`
              );
        })(),
        (() => {
          const transactionsQuery = supabase
            .from("transactions")
            .select("id, user_id, category, note, date")
            .limit(8);
          return looksLikeUuid
            ? transactionsQuery.eq("id", query)
            : transactionsQuery.or(`category.ilike.%${query}%,note.ilike.%${query}%`);
        })(),
      ])
    : [
        { data: [] },
        { data: [] },
        { data: [] },
        { data: [] },
      ];

  if (query) {
    await auditWithCurrentAdmin({
      actionType: "admin.search",
      category: "search",
      targetEntityType: "global_search",
      targetSummary: query,
      metadata: {
        query,
        userMatches: users.data?.length ?? 0,
        adminMatches: admins.data?.length ?? 0,
      },
    });
  }

  const groups = [
    {
      title: "Users",
      count: users.data?.length ?? 0,
      items:
        users.data?.map((user) => ({
          id: user.id,
          title: user.display_name ?? user.email,
          meta: `${user.email}${user.username ? ` • @${user.username}` : ""}`,
          href: `/admin/users/${user.id}`,
          badge: user.status,
        })) ?? [],
    },
    {
      title: "Admins",
      count: admins.data?.length ?? 0,
      items:
        admins.data?.map((admin) => ({
          id: admin.id,
          title: admin.display_name ?? admin.username,
          meta: admin.email ?? `@${admin.username}`,
          href: `/admin/admins/${admin.id}`,
          badge: admin.role,
        })) ?? [],
    },
    {
      title: "Subscriptions",
      count: subscriptions.data?.length ?? 0,
      items:
        subscriptions.data?.map((subscription) => ({
          id: subscription.id,
          title: subscription.id,
          meta: `${subscription.plan} • ${subscription.status}`,
          href: `/admin/users/${subscription.user_id}`,
          badge: subscription.plan,
        })) ?? [],
    },
    {
      title: "Transactions",
      count: transactions.data?.length ?? 0,
      items:
        transactions.data?.map((transaction) => ({
          id: transaction.id,
          title: transaction.category,
          meta: `${transaction.note ?? transaction.date}`,
          href: `/admin/users/${transaction.user_id}/transactions`,
          badge: transaction.date,
        })) ?? [],
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Global Search"
        description="Search across users, admins, subscriptions, and transactions."
      />
      <GlobalSearchForm />
      {!query ? (
        <Card>
          <CardContent className="p-8 text-sm text-neutral-500">
            Start with an email, username, ID, transaction note, or subscription identifier.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {groups.map((group) => (
            <Card key={group.title}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {group.title} <span className="text-neutral-400">({group.count})</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {group.items.length ? (
                  group.items.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2 hover:bg-neutral-50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-neutral-900">
                          {item.title}
                        </p>
                        <p className="truncate text-xs text-neutral-500">{item.meta}</p>
                      </div>
                      <Badge variant="secondary" className="ml-3 truncate">
                        {item.badge}
                      </Badge>
                    </Link>
                  ))
                ) : (
                  <p className="text-sm text-neutral-400">No matches.</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
