"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/lib/utils";
import { requestExportJobAction } from "./actions";

interface ExportsClientProps {
  jobs: Array<{
    id: string;
    export_type: string;
    target_scope: string;
    status: string;
    format: string;
    row_count: number | null;
    file_name: string | null;
    reason: string | null;
    created_at: string;
    completed_at: string | null;
    error_message: string | null;
  }>;
}

export function ExportsClient({ jobs }: ExportsClientProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [scope, setScope] = useState<"users" | "subscriptions" | "audit_logs" | "review_queue">(
    "users"
  );
  const [reason, setReason] = useState("");

  async function handleCreate() {
    if (!reason.trim()) {
      toast.error("Reason is required");
      return;
    }

    setSubmitting(true);
    const result = await requestExportJobAction({
      exportType: `${scope}_export`,
      targetScope: scope,
      format: "csv",
      reason,
      filters: {},
    });
    setSubmitting(false);

    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Export generated");
    setReason("");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Create Export</CardTitle>
          <CardDescription>
            Export jobs are permissioned, audited, and expire after a short window.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[180px_1fr_auto]">
          <div className="space-y-1.5">
            <Label>Scope</Label>
            <Select value={scope} onValueChange={(value) => setScope(value as typeof scope)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="users">Users</SelectItem>
                <SelectItem value="subscriptions">Subscriptions</SelectItem>
                <SelectItem value="audit_logs">Audit Logs</SelectItem>
                <SelectItem value="review_queue">Review Queue</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Why is this export required?"
            />
          </div>
          <div className="flex items-end">
            <Button onClick={handleCreate} disabled={submitting || !reason.trim()}>
              {submitting ? "Generating..." : "Generate export"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Export Jobs</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!jobs.length ? (
            <div className="px-6 py-8 text-sm text-neutral-400">No exports requested yet.</div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {jobs.map((job) => (
                <div key={job.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
                  <div>
                    <p className="text-sm font-medium text-neutral-900">
                      {job.export_type} • {job.target_scope}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {job.reason ?? "No reason"} • {formatDate(job.created_at)}
                    </p>
                    {job.error_message ? (
                      <p className="mt-1 text-xs text-red-600">{job.error_message}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase tracking-wide text-neutral-500">
                      {job.status}
                    </span>
                    {job.status === "completed" ? (
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/api/admin/exports/${job.id}`}>Download</Link>
                      </Button>
                    ) : null}
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
