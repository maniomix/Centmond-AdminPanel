"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { updateOrderStatusAction } from "../actions";
import type { OrderRow } from "@/types";

const statusOptions: OrderRow["status"][] = [
  "pending",
  "processing",
  "completed",
  "cancelled",
  "refunded",
];

export function OrderStatusForm({
  orderId,
  currentStatus,
}: {
  orderId: string;
  currentStatus: OrderRow["status"];
}) {
  const router = useRouter();
  const [status, setStatus] = useState<OrderRow["status"]>(currentStatus);
  const [loading, setLoading] = useState(false);

  async function handleUpdate() {
    setLoading(true);
    const result = await updateOrderStatusAction(orderId, status);
    if (result.error) {
      toast.error("Failed to update status");
    } else {
      toast.success("Order status updated");
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Status</Label>
        <Select value={status} onValueChange={(value) => setStatus(value as OrderRow["status"])}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        onClick={handleUpdate}
        disabled={loading || status === currentStatus}
        size="sm"
        className="w-full"
      >
        {loading ? "Updating..." : "Update status"}
      </Button>
    </div>
  );
}
