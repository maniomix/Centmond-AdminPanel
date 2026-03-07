import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { OrderStatusForm } from "./order-status-form";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: order } = await supabase.from("orders").select("*").eq("id", id).single();
  if (!order) notFound();

  const { data: user } = await supabase
    .from("users")
    .select("id, full_name, email")
    .eq("id", order.user_id)
    .single();

  const statusVariant: Record<string, "warning" | "info" | "success" | "secondary" | "destructive"> = {
    pending: "warning",
    processing: "info",
    completed: "success",
    cancelled: "secondary",
    refunded: "destructive",
  };

  const items = Array.isArray(order.items) ? order.items : [];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="h-8 w-8">
          <Link href="/admin/orders"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Order #{order.order_number}</h1>
          <p className="text-sm text-neutral-500">{formatDate(order.created_at)}</p>
        </div>
        <Badge variant={statusVariant[order.status] ?? "secondary"} className="capitalize text-xs ml-2">
          {order.status}
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Order Items</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {items.length === 0 ? (
                <div className="px-6 py-8 text-center text-sm text-neutral-400">No items.</div>
              ) : (
                <div className="divide-y divide-neutral-100">
                  {(items as Record<string, unknown>[]).map((item, i) => (
                    <div key={i} className="flex items-center justify-between px-6 py-3">
                      <div>
                        <p className="text-sm font-medium text-neutral-900">{String(item.name ?? "Item")}</p>
                        <p className="text-xs text-neutral-500">Qty: {String(item.quantity ?? 1)}</p>
                      </div>
                      <span className="text-sm font-medium text-neutral-900">
                        {order.currency} {Number(item.price ?? 0).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between border-t border-neutral-200 px-6 py-3">
                <span className="text-sm font-semibold text-neutral-900">Total</span>
                <span className="text-sm font-semibold text-neutral-900">
                  {order.currency} {order.total_amount.toFixed(2)}
                </span>
              </div>
            </CardContent>
          </Card>

          {order.notes && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-neutral-600">{order.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Update Status</CardTitle>
            </CardHeader>
            <CardContent>
              <OrderStatusForm orderId={order.id} currentStatus={order.status} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {user ? (
                <>
                  <p className="text-sm font-medium text-neutral-900">{user.full_name ?? "Unnamed"}</p>
                  <p className="text-xs text-neutral-500">{user.email}</p>
                  <Link
                    href={`/admin/users/${user.id}`}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    View user profile
                  </Link>
                </>
              ) : (
                <p className="text-sm text-neutral-400">User not found</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
