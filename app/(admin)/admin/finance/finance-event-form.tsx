"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toStoredMoney } from "@/lib/money";
import { recordFinanceEventAction } from "./actions";

export function FinanceEventForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    userId: "",
    subscriptionId: "",
    transactionId: "",
    eventType: "finance_note",
    amount: "",
    currency: "EUR",
    provider: "",
    referenceId: "",
    reason: "",
    note: "",
  });

  async function handleSubmit() {
    if (!form.reason.trim()) {
      toast.error("Reason is required");
      return;
    }

    setSubmitting(true);
    const result = await recordFinanceEventAction({
      userId: form.userId || null,
      subscriptionId: form.subscriptionId || null,
      transactionId: form.transactionId || null,
      eventType: form.eventType,
      amount: form.amount ? toStoredMoney(Number(form.amount)) : null,
      currency: form.currency || "EUR",
      provider: form.provider || null,
      referenceId: form.referenceId || null,
      reason: form.reason,
      note: form.note || null,
    });
    setSubmitting(false);

    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Finance event recorded");
    setForm({
      userId: "",
      subscriptionId: "",
      transactionId: "",
      eventType: "finance_note",
      amount: "",
      currency: "EUR",
      provider: "",
      referenceId: "",
      reason: "",
      note: "",
    });
    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Record Finance Event</CardTitle>
        <CardDescription>
          Internal operator record only. This does not trigger provider-side refunds or billing changes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1.5">
            <Label>User ID</Label>
            <Input
              value={form.userId}
              onChange={(event) => setForm((current) => ({ ...current, userId: event.target.value }))}
              placeholder="Optional UUID"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Subscription ID</Label>
            <Input
              value={form.subscriptionId}
              onChange={(event) =>
                setForm((current) => ({ ...current, subscriptionId: event.target.value }))
              }
              placeholder="Optional UUID"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Transaction ID</Label>
            <Input
              value={form.transactionId}
              onChange={(event) =>
                setForm((current) => ({ ...current, transactionId: event.target.value }))
              }
              placeholder="Optional UUID"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Event type</Label>
            <Input
              value={form.eventType}
              onChange={(event) => setForm((current) => ({ ...current, eventType: event.target.value }))}
              placeholder="refund_recorded"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Amount (EUR)</Label>
            <Input
              type="number"
              step="0.01"
              value={form.amount}
              onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
              placeholder="Optional"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Currency</Label>
            <Input
              value={form.currency}
              onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Provider</Label>
            <Input
              value={form.provider}
              onChange={(event) => setForm((current) => ({ ...current, provider: event.target.value }))}
              placeholder="stripe / apple / manual"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Reference ID</Label>
            <Input
              value={form.referenceId}
              onChange={(event) =>
                setForm((current) => ({ ...current, referenceId: event.target.value }))
              }
              placeholder="Provider or ticket reference"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Reason</Label>
          <Textarea
            rows={3}
            value={form.reason}
            onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}
            placeholder="Why is this finance event being recorded?"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Note</Label>
          <Textarea
            rows={3}
            value={form.note}
            onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
            placeholder="Optional internal finance note"
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSubmit} disabled={submitting || !form.reason.trim()}>
            {submitting ? "Recording..." : "Record finance event"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
