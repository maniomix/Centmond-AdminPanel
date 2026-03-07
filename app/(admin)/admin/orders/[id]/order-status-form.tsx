"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

const statusOptions = ["pending", "processing", "completed", "cancelled", "refunded"];

export function OrderStatusForm({ orderId, currentStatus }: { orderId: string; currentStatus: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [status, setStatus] = useState(currentStatus);
  const [loading, setLoading] = useState(false);

  async function handleUpdate() {
    setLoading(true);
    const { error } = await supabase
      .from("orders")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", orderId);

    if (error) {
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
        <Select value={status} onValueChange={setStatus}>
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
