import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { UserEditForm } from "./user-edit-form";
import { formatEuroAmount } from "@/lib/money";

const planVariant: Record<string, "default" | "secondary" | "success"> = {
  free: "secondary",
  monthly: "default",
  yearly: "success",
};

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: user } = await supabase.from("users").select("*").eq("id", id).single();
  if (!user) notFound();

  const [{ data: subscription }, { data: recentTransactions }, { data: recentEvents }] =
    await Promise.all([
      supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("transactions")
        .select("id, amount, type, category, note, date, created_at")
        .eq("user_id", id)
        .eq("is_deleted", false)
        .order("date", { ascending: false })
        .limit(6),
      supabase
        .from("events")
        .select("id, event_name, event_properties, created_at")
        .eq("user_id", id)
        .order("created_at", { ascending: false })
        .limit(6),
    ]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="h-8 w-8">
          <Link href="/admin/users">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">
            {(user.display_name ?? "Unnamed User").trim()}
          </h1>
          <p className="text-sm text-neutral-500">{user.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Edit User</CardTitle>
              <CardDescription>Update profile and verification state.</CardDescription>
            </CardHeader>
            <CardContent>
              <UserEditForm user={user} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {!recentTransactions?.length ? (
                <div className="px-6 py-8 text-center text-sm text-neutral-400">
                  No transactions found.
                </div>
              ) : (
                <div className="divide-y divide-neutral-100">
                  {recentTransactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between px-6 py-3">
                      <div>
                        <p className="text-sm font-medium text-neutral-900 capitalize">
                          {tx.category}
                        </p>
                        <p className="text-xs text-neutral-500">{tx.note ?? tx.date}</p>
                      </div>
                      <span
                        className={`text-sm font-semibold ${
                          tx.type === "income" ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {tx.type === "income" ? "+" : "-"}
                        {formatEuroAmount(tx.amount)} €
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recent Events</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {!recentEvents?.length ? (
                <div className="px-6 py-8 text-center text-sm text-neutral-400">
                  No events found.
                </div>
              ) : (
                <div className="divide-y divide-neutral-100">
                  {recentEvents.map((event) => (
                    <div key={event.id} className="px-6 py-3">
                      <p className="text-sm font-medium text-neutral-900">{event.event_name}</p>
                      <p className="text-xs text-neutral-500">{formatDate(event.created_at)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Account Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-neutral-500">Email verification</p>
                <Badge
                  variant={user.is_email_verified ? "success" : "warning"}
                  className="mt-1 text-xs"
                >
                  {user.is_email_verified ? "Verified" : "Unverified"}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-neutral-500">Member since</p>
                <p className="mt-0.5 text-sm text-neutral-900">{formatDate(user.created_at)}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500">Last active</p>
                <p className="mt-0.5 text-sm text-neutral-900">
                  {user.last_active_at ? formatDate(user.last_active_at) : "Never"}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500">User ID</p>
                <p className="mt-0.5 text-xs text-neutral-500 font-mono break-all">{user.id}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Subscription</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {subscription ? (
                <>
                  <div>
                    <p className="text-xs text-neutral-500">Plan</p>
                    <Badge
                      variant={planVariant[subscription.plan] ?? "secondary"}
                      className="mt-1 text-xs capitalize"
                    >
                      {subscription.plan}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500">Status</p>
                    <p className="mt-0.5 text-sm text-neutral-900 capitalize">{subscription.status}</p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500">Platform</p>
                    <p className="mt-0.5 text-sm text-neutral-900">{subscription.platform ?? "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500">Current period end</p>
                    <p className="mt-0.5 text-sm text-neutral-900">
                      {subscription.current_period_end
                        ? formatDate(subscription.current_period_end)
                        : "-"}
                    </p>
                  </div>
                  <Button size="sm" asChild className="w-full">
                    <Link href={`/admin/subscriptions?userId=${id}`}>
                      Manage Subscription
                    </Link>
                  </Button>
                </>
              ) : (
                <p className="text-sm text-neutral-400">No subscription found.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
