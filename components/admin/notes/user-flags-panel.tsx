"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ReasonDialog } from "@/components/admin/actions/reason-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/lib/utils";
import { assignUserFlagAction, resolveUserFlagAction } from "@/app/(admin)/admin/users/[id]/collaboration-actions";

interface UserFlagOption {
  id: string;
  key: string;
  label: string;
  severity: "info" | "warning" | "critical";
}

interface UserFlagAssignmentView {
  id: string;
  reason: string | null;
  status: "active" | "resolved" | "dismissed";
  created_at: string;
  flag: UserFlagOption;
}

interface UserFlagsPanelProps {
  userId: string;
  allFlags: UserFlagOption[];
  activeFlags: UserFlagAssignmentView[];
  canManageFlags?: boolean;
}

const severityVariant: Record<string, "info" | "warning" | "destructive" | "secondary"> = {
  info: "info",
  warning: "warning",
  critical: "destructive",
};

export function UserFlagsPanel({
  userId,
  allFlags,
  activeFlags,
  canManageFlags = true,
}: UserFlagsPanelProps) {
  const router = useRouter();
  const [selectedFlagId, setSelectedFlagId] = useState("");
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [resolveTarget, setResolveTarget] = useState<UserFlagAssignmentView | null>(null);

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Flags</CardTitle>
          <CardDescription>Risk, moderation, finance and support escalation flags.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {canManageFlags ? (
            <div className="flex gap-2">
              <Select value={selectedFlagId} onValueChange={setSelectedFlagId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a flag" />
                </SelectTrigger>
                <SelectContent>
                  {allFlags.map((flag) => (
                    <SelectItem key={flag.id} value={flag.id}>
                      {flag.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button disabled={!selectedFlagId} onClick={() => setAssignDialogOpen(true)}>
                Add flag
              </Button>
            </div>
          ) : (
            <p className="text-sm text-neutral-400">This role can review flags but cannot change them.</p>
          )}

          {activeFlags.length ? (
            <div className="space-y-3">
              {activeFlags.map((assignment) => (
                <div key={assignment.id} className="rounded-lg border border-neutral-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={severityVariant[assignment.flag.severity] ?? "secondary"}
                      >
                        {assignment.flag.label}
                      </Badge>
                      <span className="text-xs text-neutral-500">{assignment.status}</span>
                    </div>
                    {canManageFlags ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setResolveTarget(assignment)}
                      >
                        Resolve
                      </Button>
                    ) : null}
                  </div>
                  <p className="mt-2 text-xs text-neutral-500">{formatDate(assignment.created_at)}</p>
                  {assignment.reason ? (
                    <p className="mt-2 text-sm text-neutral-700">{assignment.reason}</p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-neutral-400">No active flags.</p>
          )}
        </CardContent>
      </Card>

      <ReasonDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        title="Assign user flag"
        description="Flags should only be added with an operational reason."
        confirmLabel="Add flag"
        loadingLabel="Saving..."
        onConfirm={async (reason) => {
          if (!selectedFlagId) return;
          const result = await assignUserFlagAction(userId, selectedFlagId, reason);
          if (result.error) {
            toast.error(result.error);
          } else {
            toast.success("Flag added");
            setAssignDialogOpen(false);
            setSelectedFlagId("");
            router.refresh();
          }
        }}
      />

      <ReasonDialog
        open={!!resolveTarget}
        onOpenChange={(open) => !open && setResolveTarget(null)}
        title="Resolve flag"
        description={
          resolveTarget ? `Resolve "${resolveTarget.flag.label}" with an audit reason.` : undefined
        }
        confirmLabel="Resolve"
        loadingLabel="Saving..."
        onConfirm={async (reason) => {
          if (!resolveTarget) return;
          const result = await resolveUserFlagAction(resolveTarget.id, userId, reason);
          if (result.error) {
            toast.error(result.error);
          } else {
            toast.success("Flag resolved");
            setResolveTarget(null);
            router.refresh();
          }
        }}
      />
    </>
  );
}
