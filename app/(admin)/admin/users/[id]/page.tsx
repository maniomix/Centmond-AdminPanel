import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { UserEditForm } from "./user-edit-form";

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: user } = await supabase.from("users").select("*").eq("id", id).single();

  if (!user) notFound();

  const { data: recentOrders } = await supabase
    .from("orders")
    .select("id, order_number, status, total_amount, currency, created_at")
    .eq("user_id", id)
    .order("created_at", { ascending: false })
    .limit(5);

  const statusBadge: Record<string, "success" | "secondary" | "destructive"> = {
    active: "success",
    inactive: "secondary",
    suspended: "destructive",
  };

  const orderStatusBadge: Record<string, "success" | "warning" | "secondary" | "destructive" | "info"> = {
    completed: "success",
    pending: "warning",
    processing: "info",
    cancelled: "secondary",
    refunded: "destructive",
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="h-8 w-8">
          <Link href="/admin/users">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">{user.full_name ?? "Unnamed User"}</h1>
          <p className="text-sm text-neutral-500">{user.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Edit User</CardTitle>
            </CardHeader>
            <CardContent>
              <UserEditForm user={user} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recent Orders</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {!recentOrders?.length ? (
                <div className="px-6 py-8 text-center text-sm text-neutral-400">No orders found.</div>
              ) : (
                <div className="divide-y divide-neutral-100">
                  {recentOrders.map((order) => (
                    <div key={order.id} className="flex items-center justify-between px-6 py-3">
                      <div>
                        <p className="text-sm font-medium text-neutral-900">#{order.order_number}</p>
                        <p className="text-xs text-neutral-500">{formatDate(order.created_at)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={orderStatusBadge[order.status] ?? "secondary"} className="capitalize text-xs">
                          {order.status}
                        </Badge>
                        <span className="text-sm font-medium text-neutral-900">
                          {order.currency} {order.total_amount.toFixed(2)}
                        </span>
                      </div>
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
                <p className="text-xs text-neutral-500">Status</p>
                <Badge variant={statusBadge[user.status]} className="mt-1 capitalize text-xs">
                  {user.status}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-neutral-500">Role</p>
                <p className="mt-0.5 text-sm font-medium capitalize text-neutral-900">{user.role}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500">Member since</p>
                <p className="mt-0.5 text-sm text-neutral-900">{formatDate(user.created_at)}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500">Last login</p>
                <p className="mt-0.5 text-sm text-neutral-900">
                  {user.last_login ? formatDate(user.last_login) : "Never"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
