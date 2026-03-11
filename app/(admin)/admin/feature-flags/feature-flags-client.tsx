"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/utils";
import { upsertFeatureFlagAction } from "./actions";

interface FeatureFlagsClientProps {
  canManageFlags?: boolean;
  flags: Array<{
    key: string;
    label: string;
    description: string | null;
    enabled: boolean;
    rollout_percentage: number;
    audience_filters: unknown;
    updated_at: string;
  }>;
}

export function FeatureFlagsClient({
  flags,
  canManageFlags = false,
}: FeatureFlagsClientProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    key: "",
    label: "",
    description: "",
    enabled: false,
    rolloutPercentage: "100",
    audienceFilters: "{}",
    reason: "",
  });

  async function handleSubmit() {
    let audienceFilters: Record<string, unknown> | null = null;
    try {
      audienceFilters = JSON.parse(form.audienceFilters || "{}") as Record<string, unknown>;
    } catch {
      toast.error("Audience filters must be valid JSON");
      return;
    }

    setSubmitting(true);
    const result = await upsertFeatureFlagAction({
      key: form.key,
      label: form.label,
      description: form.description || null,
      enabled: form.enabled,
      rolloutPercentage: Number(form.rolloutPercentage || 100),
      audienceFilters,
      reason: form.reason,
    });
    setSubmitting(false);

    const errorMessage = "error" in result ? result.error : undefined;
    if (typeof errorMessage === "string" && errorMessage) {
      toast.error(errorMessage);
      return;
    }

    toast.success("Feature flag saved");
    setForm({
      key: "",
      label: "",
      description: "",
      enabled: false,
      rolloutPercentage: "100",
      audienceFilters: "{}",
      reason: "",
    });
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Add or Update Feature Flag</CardTitle>
          <CardDescription>Operational toggles should be explicit, documented, and audited.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {canManageFlags ? (
            <>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-1.5">
                  <Label>Key</Label>
                  <Input value={form.key} onChange={(event) => setForm((current) => ({ ...current, key: event.target.value }))} placeholder="ops.new_checkout" />
                </div>
                <div className="space-y-1.5">
                  <Label>Label</Label>
                  <Input value={form.label} onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))} placeholder="New checkout rollout" />
                </div>
                <div className="space-y-1.5">
                  <Label>Rollout %</Label>
                  <Input type="number" min="0" max="100" value={form.rolloutPercentage} onChange={(event) => setForm((current) => ({ ...current, rolloutPercentage: event.target.value }))} />
                </div>
                <label className="flex items-end gap-2 text-sm text-neutral-700">
                  <input type="checkbox" checked={form.enabled} onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))} />
                  Enabled
                </label>
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Input value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Explain the operational intent" />
              </div>
              <div className="space-y-1.5">
                <Label>Audience filters (JSON)</Label>
                <Textarea rows={4} value={form.audienceFilters} onChange={(event) => setForm((current) => ({ ...current, audienceFilters: event.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Reason</Label>
                <Input value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Why is this flag being changed?" />
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSubmit} disabled={submitting || !form.key.trim() || !form.label.trim() || !form.reason.trim()}>
                  {submitting ? "Saving..." : "Save feature flag"}
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-neutral-500">
              You can inspect flag state here, but only configuration managers can edit rollout settings.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Current Flags</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!flags.length ? (
            <p className="text-sm text-neutral-400">No feature flags configured yet.</p>
          ) : (
            flags.map((flag) => (
              <div key={flag.key} className="rounded-lg border border-neutral-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-neutral-900">{flag.label}</p>
                    <p className="text-xs text-neutral-500">{flag.key}</p>
                  </div>
                  <span className="text-xs uppercase tracking-wide text-neutral-500">
                    {flag.enabled ? `enabled • ${flag.rollout_percentage}%` : "disabled"}
                  </span>
                </div>
                {flag.description ? <p className="mt-2 text-sm text-neutral-600">{flag.description}</p> : null}
                <p className="mt-2 text-xs text-neutral-500">Updated {formatDate(flag.updated_at)}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
