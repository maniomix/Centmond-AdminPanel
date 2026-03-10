"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { runBulkUserActionAction } from "@/app/(admin)/admin/users/actions";

type BulkActionType = "suspend" | "reactivate" | "mark_under_review" | "add_tag";

interface UserBulkActionsProps {
  selectedUserIds: string[];
  allTags: Array<{
    id: string;
    key: string;
    label: string;
    color: string | null;
  }>;
  capabilities: {
    canSuspendUsers: boolean;
    canReactivateUsers: boolean;
    canManageTags: boolean;
    canRunBulkActions: boolean;
    canReviewUsers: boolean;
  };
  onClearSelection: () => void;
}

const ACTION_LABELS: Record<BulkActionType, string> = {
  suspend: "Suspend users",
  reactivate: "Reactivate users",
  mark_under_review: "Send to review",
  add_tag: "Add tag",
};

export function UserBulkActions({
  selectedUserIds,
  allTags,
  capabilities,
  onClearSelection,
}: UserBulkActionsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [action, setAction] = useState<BulkActionType | "">("");
  const [tagId, setTagId] = useState("");
  const [reason, setReason] = useState("");

  const availableActions = useMemo(() => {
    const actions: BulkActionType[] = [];
    if (capabilities.canSuspendUsers) actions.push("suspend");
    if (capabilities.canReactivateUsers) actions.push("reactivate");
    if (capabilities.canReviewUsers) actions.push("mark_under_review");
    if (capabilities.canManageTags) actions.push("add_tag");
    return actions;
  }, [capabilities]);

  async function handleRun() {
    if (!action) return;
    if (!reason.trim()) {
      toast.error("Reason is required");
      return;
    }
    if (action === "add_tag" && !tagId) {
      toast.error("Select a tag");
      return;
    }

    setSubmitting(true);
    const result =
      action === "add_tag"
        ? await runBulkUserActionAction({
            action,
            userIds: selectedUserIds,
            tagId,
            reason,
          })
        : await runBulkUserActionAction({
            action,
            userIds: selectedUserIds,
            reason,
          });
    setSubmitting(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(
      `${ACTION_LABELS[action]} applied to ${result.affectedCount ?? selectedUserIds.length} users`
    );
    setOpen(false);
    setAction("");
    setTagId("");
    setReason("");
    onClearSelection();
    router.refresh();
  }

  if (!capabilities.canRunBulkActions || !availableActions.length) return null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
        <p className="text-sm font-medium text-neutral-900">
          {selectedUserIds.length} user{selectedUserIds.length === 1 ? "" : "s"} selected
        </p>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          Run bulk action
        </Button>
        <Button variant="ghost" size="sm" onClick={onClearSelection}>
          Clear selection
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Run bulk action</DialogTitle>
            <DialogDescription>
              Sensitive actions require a reason and will be written to the admin audit log.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Action</Label>
              <Select value={action} onValueChange={(value) => setAction(value as BulkActionType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select bulk action" />
                </SelectTrigger>
                <SelectContent>
                  {availableActions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {ACTION_LABELS[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {action === "add_tag" ? (
              <div className="space-y-1.5">
                <Label>Tag</Label>
                <Select value={tagId} onValueChange={setTagId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select tag" />
                  </SelectTrigger>
                  <SelectContent>
                    {allTags.map((tag) => (
                      <SelectItem key={tag.id} value={tag.id}>
                        {tag.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Textarea
                rows={4}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Why are you applying this action to the selected users?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRun} disabled={submitting || !action}>
              {submitting ? "Running..." : "Apply action"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
