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
import { upsertInternalSettingAction } from "./actions";

interface InternalSettingsClientProps {
  settings: Array<{
    key: string;
    label: string;
    description: string | null;
    value: unknown;
    is_sensitive: boolean;
    updated_at: string;
  }>;
}

export function InternalSettingsClient({ settings }: InternalSettingsClientProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    key: "",
    label: "",
    description: "",
    value: "{}",
    isSensitive: false,
    reason: "",
  });

  async function handleSubmit() {
    let parsedValue: Record<string, unknown>;
    try {
      parsedValue = JSON.parse(form.value || "{}") as Record<string, unknown>;
    } catch {
      toast.error("Setting value must be valid JSON");
      return;
    }

    setSubmitting(true);
    const result = await upsertInternalSettingAction({
      key: form.key,
      label: form.label,
      description: form.description || null,
      value: parsedValue,
      isSensitive: form.isSensitive,
      reason: form.reason,
    });
    setSubmitting(false);

    const errorMessage = "error" in result ? result.error : undefined;
    if (typeof errorMessage === "string" && errorMessage) {
      toast.error(errorMessage);
      return;
    }

    toast.success("Internal setting saved");
    setForm({
      key: "",
      label: "",
      description: "",
      value: "{}",
      isSensitive: false,
      reason: "",
    });
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Add or Update Setting</CardTitle>
          <CardDescription>
            Org-wide operational settings live here, not in self-service admin settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Key</Label>
              <Input value={form.key} onChange={(event) => setForm((current) => ({ ...current, key: event.target.value }))} placeholder="billing.refund_max_days" />
            </div>
            <div className="space-y-1.5">
              <Label>Label</Label>
              <Input value={form.label} onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))} placeholder="Refund max days" />
            </div>
            <label className="flex items-end gap-2 text-sm text-neutral-700">
              <input type="checkbox" checked={form.isSensitive} onChange={(event) => setForm((current) => ({ ...current, isSensitive: event.target.checked }))} />
              Sensitive
            </label>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Explain what this setting controls" />
          </div>
          <div className="space-y-1.5">
            <Label>Value (JSON)</Label>
            <Textarea rows={5} value={form.value} onChange={(event) => setForm((current) => ({ ...current, value: event.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Input value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Why is this setting being changed?" />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={submitting || !form.key.trim() || !form.label.trim() || !form.reason.trim()}>
              {submitting ? "Saving..." : "Save internal setting"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Current Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!settings.length ? (
            <p className="text-sm text-neutral-400">No internal settings configured yet.</p>
          ) : (
            settings.map((setting) => (
              <div key={setting.key} className="rounded-lg border border-neutral-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-neutral-900">{setting.label}</p>
                    <p className="text-xs text-neutral-500">{setting.key}</p>
                  </div>
                  <span className="text-xs uppercase tracking-wide text-neutral-500">
                    {setting.is_sensitive ? "sensitive" : "standard"}
                  </span>
                </div>
                {setting.description ? <p className="mt-2 text-sm text-neutral-600">{setting.description}</p> : null}
                <pre className="mt-2 overflow-x-auto rounded bg-neutral-50 p-2 text-xs text-neutral-600">
                  {JSON.stringify(setting.value, null, 2)}
                </pre>
                <p className="mt-2 text-xs text-neutral-500">Updated {formatDate(setting.updated_at)}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
