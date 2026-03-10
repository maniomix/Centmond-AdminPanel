"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { toast } from "sonner";
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
import { Badge } from "@/components/ui/badge";
import { assignUserTagAction, removeUserTagAction } from "@/app/(admin)/admin/users/[id]/collaboration-actions";

interface UserTagOption {
  id: string;
  key: string;
  label: string;
  color: string | null;
}

interface UserTagsPanelProps {
  userId: string;
  allTags: UserTagOption[];
  assignedTags: UserTagOption[];
  canManageTags?: boolean;
}

export function UserTagsPanel({
  userId,
  allTags,
  assignedTags,
  canManageTags = true,
}: UserTagsPanelProps) {
  const router = useRouter();
  const [selectedTagId, setSelectedTagId] = useState<string>("");

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Tags</CardTitle>
        <CardDescription>Collaborative operational labels for this user.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {canManageTags ? (
          <div className="flex gap-2">
            <Select value={selectedTagId} onValueChange={setSelectedTagId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a tag" />
              </SelectTrigger>
              <SelectContent>
                {allTags.map((tag) => (
                  <SelectItem key={tag.id} value={tag.id}>
                    {tag.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={async () => {
                if (!selectedTagId) return;
                const result = await assignUserTagAction(userId, selectedTagId);
                if (result.error) {
                  toast.error(result.error);
                } else {
                  toast.success("Tag added");
                  setSelectedTagId("");
                  router.refresh();
                }
              }}
              disabled={!selectedTagId}
            >
              Add tag
            </Button>
          </div>
        ) : (
          <p className="text-sm text-neutral-400">This role can review tags but cannot modify them.</p>
        )}

        {assignedTags.length ? (
          <div className="flex flex-wrap gap-2">
            {assignedTags.map((tag) => (
              <Badge key={tag.id} variant="secondary" className="gap-1">
                {tag.label}
                {canManageTags ? (
                  <button
                    type="button"
                    className="rounded-full p-0.5 hover:bg-neutral-200"
                    onClick={async () => {
                      const result = await removeUserTagAction(userId, tag.id);
                      if (result.error) {
                        toast.error(result.error);
                      } else {
                        toast.success("Tag removed");
                        router.refresh();
                      }
                    }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                ) : null}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-neutral-400">No tags assigned.</p>
        )}
      </CardContent>
    </Card>
  );
}
