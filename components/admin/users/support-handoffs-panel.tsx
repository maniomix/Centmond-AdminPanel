"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { createSupportHandoffAction } from "@/app/(admin)/admin/reviews/actions";

interface SupportHandoffsPanelProps {
  userId: string;
  handoffs: Array<{
    id: string;
    status: string;
    priority: string;
    summary: string;
    details: string | null;
    created_at: string;
    fromLabel: string;
    toLabel: string | null;
  }>;
  adminOptions: Array<{
    id: string;
    label: string;
  }>;
  canManageSupport?: boolean;
}

export function SupportHandoffsPanel({
  userId,
  handoffs,
  adminOptions,
  canManageSupport = false,
}: SupportHandoffsPanelProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [toAdminId, setToAdminId] = useState("");
  const [priority, setPriority] = useState("normal");
  const [summary, setSummary] = useState("");
  const [details, setDetails] = useState("");

  async function handleCreate() {
    if (!summary.trim()) {
      toast.error("Summary is required");
      return;
    }

    setSubmitting(true);
    const result = await createSupportHandoffAction({
      userId,
      toAdminId: toAdminId || null,
      priority,
      summary,
      details: details || null,
    });
    setSubmitting(false);

    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Support handoff created");
    setToAdminId("");
    setPriority("normal");
    setSummary("");
    setDetails("");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Support Handoffs</CardTitle>
        <CardDescription>Escalations, follow-ups, and internal ownership transfers.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {canManageSupport ? (
          <div className="space-y-3 rounded-lg border border-neutral-200 p-3">
            <div className="grid gap-3 md:grid-cols-[180px_1fr]">
              <div className="space-y-1.5">
                <Label>Assign to</Label>
                <Select value={toAdminId} onValueChange={setToAdminId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Optional assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    {adminOptions.map((admin) => (
                      <SelectItem key={admin.id} value={admin.id}>
                        {admin.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Summary</Label>
              <Input value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="Short handoff summary" />
            </div>
            <div className="space-y-1.5">
              <Label>Details</Label>
              <Textarea rows={3} value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Context, next steps, blocker, or customer expectation" />
            </div>
            <div className="flex justify-end">
              <Button onClick={handleCreate} disabled={submitting || !summary.trim()}>
                {submitting ? "Creating..." : "Create handoff"}
              </Button>
            </div>
          </div>
        ) : null}

        {!handoffs.length ? (
          <p className="text-sm text-neutral-400">No support handoffs yet.</p>
        ) : (
          <div className="space-y-3">
            {handoffs.map((handoff) => (
              <div key={handoff.id} className="rounded-lg border border-neutral-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-neutral-900">{handoff.summary}</p>
                    <Badge variant="secondary">{handoff.priority}</Badge>
                  </div>
                  <p className="text-xs text-neutral-500">{formatDate(handoff.created_at)}</p>
                </div>
                <p className="mt-1 text-xs text-neutral-500">
                  {handoff.fromLabel}
                  {handoff.toLabel ? ` -> ${handoff.toLabel}` : " -> unassigned"} • {handoff.status}
                </p>
                {handoff.details ? <p className="mt-2 text-sm text-neutral-600">{handoff.details}</p> : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
