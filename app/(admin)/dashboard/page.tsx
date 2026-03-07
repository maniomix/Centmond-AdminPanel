import { createClient } from "@/lib/supabase/server";
import { Users, ShoppingCart, FileText, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

async function getStats() {
  const supabase = await createClient();

  const [
    { count: totalUsers },
    { count: activeUsers },
    { count: pendingOrders },
    { count: totalOrders },
    { count: publishedContent },
  ] = await Promise.all([
    supabase.from("users").select("*", { count: "exact", head: true }),
    supabase.from("users").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("orders").select("*", { count: "exact", head: true }),
    supabase.from("content").select("*", { count: "exact", head: true }).eq("status", "published"),
  ]);

  return {
    totalUsers: totalUsers ?? 0,
    activeUsers: activeUsers ?? 0,
    pendingOrders: pendingOrders ?? 0,
    totalOrders: totalOrders ?? 0,
    publishedContent: publishedContent ?? 0,
  };
}

async function getRecentActivity() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("activity_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);
  return data ?? [];
}

const statCards = [
  { label: "Total Users", key: "totalUsers", icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
  { label: "Active Users", key: "activeUsers", icon: TrendingUp, color: "text-green-600", bg: "bg-green-50" },
  { label: "Pending Orders", key: "pendingOrders", icon: ShoppingCart, color: "text-amber-600", bg: "bg-amber-50" },
  { label: "Total Orders", key: "totalOrders", icon: ShoppingCart, color: "text-neutral-600", bg: "bg-neutral-100" },
  { label: "Published Content", key: "publishedContent", icon: FileText, color: "text-purple-600", bg: "bg-purple-50" },
];

export default async function DashboardPage() {
  const [stats, activity] = await Promise.all([getStats(), getRecentActivity()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Dashboard</h1>
        <p className="mt-0.5 text-sm text-neutral-500">Overview of your application data.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        {statCards.map(({ label, key, icon: Icon, color, bg }) => (
          <Card key={key}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">{label}</p>
                  <p className="mt-1.5 text-2xl font-semibold text-neutral-900">
                    {stats[key as keyof typeof stats]}
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

      {/* Recent Activity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {activity.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-neutral-400">
              No recent activity.
            </div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {activity.map((log) => (
                <div key={log.id} className="flex items-center justify-between px-6 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-neutral-400" />
                    <div>
                      <p className="text-sm font-medium text-neutral-900">{log.action}</p>
                      <p className="text-xs text-neutral-500">{log.resource_type}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="text-xs">
                      {log.resource_type}
                    </Badge>
                    <span className="text-xs text-neutral-400">{formatDate(log.created_at)}</span>
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
