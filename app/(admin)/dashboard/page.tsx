import { createAdminClient } from "@/lib/supabase/admin";
import { Users, ShieldCheck, BadgeDollarSign, Activity, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { LiveRefresh } from "@/components/shared/live-refresh";
import { formatRawEuro, fromStoredMoney } from "@/lib/money";

export const revalidate = 0;

async function getStats() {
  const supabase = createAdminClient();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: totalUsers },
    { count: verifiedUsers },
    { count: totalSubscriptions },
    { count: paidSubscriptions },
    { count: monthlyPlans },
    { count: events24h },
    { data: txRows },
  ] = await Promise.all([
    supabase.from("users").select("*", { count: "exact", head: true }),
    supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .eq("is_email_verified", true),
    supabase.from("subscriptions").select("*", { count: "exact", head: true }),
    supabase
      .from("subscriptions")
      .select("*", { count: "exact", head: true })
      .neq("status", "free"),
    supabase
      .from("subscriptions")
      .select("*", { count: "exact", head: true })
      .eq("plan", "monthly"),
    supabase
      .from("events")
      .select("*", { count: "exact", head: true })
      .gte("created_at", since24h),
    supabase
      .from("transactions")
      .select("amount, type")
      .eq("is_deleted", false),
  ]);

  const totals = (txRows ?? []).reduce(
    (acc, row) => {
      const amount = fromStoredMoney(Number(row.amount ?? 0));
      if (row.type === "income") acc.income += amount;
      else acc.expense += amount;
      return acc;
    },
    { income: 0, expense: 0 }
  );

  return {
    totalUsers: totalUsers ?? 0,
    verifiedUsers: verifiedUsers ?? 0,
    totalSubscriptions: totalSubscriptions ?? 0,
    paidSubscriptions: paidSubscriptions ?? 0,
    monthlyPlans: monthlyPlans ?? 0,
    events24h: events24h ?? 0,
    income: totals.income,
    expense: totals.expense,
    net: totals.income - totals.expense,
  };
}

async function getRecentEvents() {
  const supabase = createAdminClient();

  const { data: events } = await supabase
    .from("events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(12);

  const userIds = Array.from(
    new Set((events ?? []).map((event) => event.user_id).filter(Boolean))
  ) as string[];

  const { data: users } = userIds.length
    ? await supabase.from("users").select("id, email, display_name").in("id", userIds)
    : { data: [] };

  const usersById = new Map((users ?? []).map((user) => [user.id, user]));

  return (events ?? []).map((event) => ({
    ...event,
    user: event.user_id ? usersById.get(event.user_id) ?? null : null,
  }));
}

const statCards = [
  {
    key: "totalUsers",
    label: "Total Users",
    icon: Users,
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    key: "verifiedUsers",
    label: "Verified Users",
    icon: ShieldCheck,
    color: "text-green-600",
    bg: "bg-green-50",
  },
  {
    key: "totalSubscriptions",
    label: "Total Subscriptions",
    icon: BadgeDollarSign,
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
  {
    key: "paidSubscriptions",
    label: "Paid Subscriptions",
    icon: BadgeDollarSign,
    color: "text-purple-600",
    bg: "bg-purple-50",
  },
  {
    key: "monthlyPlans",
    label: "Monthly Plans",
    icon: Wallet,
    color: "text-neutral-700",
    bg: "bg-neutral-100",
  },
  {
    key: "events24h",
    label: "Events (24h)",
    icon: Activity,
    color: "text-cyan-700",
    bg: "bg-cyan-50",
  },
] as const;

export default async function DashboardPage() {
  const [stats, recentEvents] = await Promise.all([getStats(), getRecentEvents()]);

  return (
    <div className="space-y-6">
      <LiveRefresh
        tables={[
          { table: "users" },
          { table: "subscriptions" },
          { table: "transactions" },
          { table: "events" },
        ]}
        intervalFallbackMs={30000}
      />

      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Dashboard</h1>
        <p className="mt-0.5 text-sm text-neutral-500">
          Live operational overview for users, subscriptions and financial activity.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {statCards.map(({ key, label, icon: Icon, color, bg }) => (
          <Card key={key}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    {label}
                  </p>
                  <p className="mt-1.5 text-2xl font-semibold text-neutral-900">
                    {stats[key]}
                  </p>
                </div>
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${bg}`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Income</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-green-600">
              +{formatRawEuro(stats.income)} €
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Expense</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-red-600">
              -{formatRawEuro(stats.expense)} €
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Net Cashflow</CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`text-2xl font-semibold ${
                stats.net >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {(stats.net >= 0 ? "+" : "") + formatRawEuro(stats.net)} €
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Events</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recentEvents.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-neutral-400">
              No recent events.
            </div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {recentEvents.map((event) => (
                <div key={event.id} className="flex items-center justify-between px-6 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-neutral-400" />
                    <div>
                      <p className="text-sm font-medium text-neutral-900">{event.event_name}</p>
                      <p className="text-xs text-neutral-500">
                        {event.user
                          ? event.user.display_name ?? event.user.email
                          : "Unknown user"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="text-xs">
                      {event.user?.email ?? "-"}
                    </Badge>
                    <span className="text-xs text-neutral-400">
                      {formatDate(event.created_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
