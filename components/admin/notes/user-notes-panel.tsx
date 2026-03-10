"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pin, PinOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/utils";
import type { UserNoteRow } from "@/types";
import { addUserNoteAction, toggleUserNotePinAction } from "@/app/(admin)/admin/users/[id]/collaboration-actions";

interface UserNotesPanelProps {
  userId: string;
  notes: Array<
    UserNoteRow & {
      authorLabel: string;
    }
  >;
  canManageNotes?: boolean;
}

export function UserNotesPanel({
  userId,
  notes,
  canManageNotes = true,
}: UserNotesPanelProps) {
  const router = useRouter();
  const [noteType, setNoteType] = useState<
    "general" | "support" | "finance" | "risk" | "moderation"
  >("general");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleAddNote() {
    if (!body.trim()) return;
    setSubmitting(true);
    const result = await addUserNoteAction({
      userId,
      noteType,
      body,
    });
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Note added");
      setBody("");
      setNoteType("general");
      router.refresh();
    }
    setSubmitting(false);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Internal Notes</CardTitle>
        <CardDescription>Support, finance, risk, and moderation context.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {canManageNotes ? (
          <div className="space-y-3 rounded-lg border border-neutral-200 p-3">
            <div className="grid gap-3 md:grid-cols-[180px_1fr]">
              <div className="space-y-1.5">
                <Label>Note type</Label>
                <Select
                  value={noteType}
                  onValueChange={(value) => setNoteType(value as typeof noteType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="support">Support</SelectItem>
                    <SelectItem value="finance">Finance</SelectItem>
                    <SelectItem value="risk">Risk</SelectItem>
                    <SelectItem value="moderation">Moderation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Note</Label>
                <Textarea
                  rows={4}
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder="Write internal context for future admins..."
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleAddNote} disabled={submitting || !body.trim()}>
                {submitting ? "Saving..." : "Add note"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-neutral-200 p-3 text-sm text-neutral-400">
            You can review notes, but this role cannot create or pin them.
          </div>
        )}

        <div className="space-y-3">
          {!notes.length ? (
            <p className="text-sm text-neutral-400">No internal notes yet.</p>
          ) : (
            notes.map((note) => (
              <div key={note.id} className="rounded-lg border border-neutral-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-neutral-900 capitalize">
                      {note.note_type} note
                    </p>
                    <p className="text-xs text-neutral-500">
                      {note.authorLabel} • {formatDate(note.created_at)}
                    </p>
                  </div>
                  {canManageNotes ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        const result = await toggleUserNotePinAction(
                          note.id,
                          userId,
                          !note.is_pinned
                        );
                        if (result.error) {
                          toast.error(result.error);
                        } else {
                          toast.success(note.is_pinned ? "Note unpinned" : "Note pinned");
                          router.refresh();
                        }
                      }}
                    >
                      {note.is_pinned ? (
                        <PinOff className="h-4 w-4" />
                      ) : (
                        <Pin className="h-4 w-4" />
                      )}
                      {note.is_pinned ? "Unpin" : "Pin"}
                    </Button>
                  ) : null}
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm text-neutral-700">{note.body}</p>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
