"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BadgeCheck,
  BadgeX,
  Clock3,
  Crown,
  Eye,
  MoreHorizontal,
  ReceiptText,
  ShieldCheck,
  ShieldAlert,
  ShieldBan,
  ShieldMinus,
  Trash2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { ReasonDialog } from "@/components/admin/actions/reason-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { UserRow } from "@/types";
import {
  applySubscriptionPresetAction,
  deleteSubscriptionAction,
  deleteUserAction,
  setUserLastActiveNowAction,
  setUserVerificationAction,
  updateUserStatusAction,
} from "./actions";

interface UserRowActionsProps {
  user: Pick<UserRow, "id" | "email" | "display_name" | "is_email_verified" | "status">;
  subscription?: {
    id: string;
    plan: string;
    status: string;
    updated_at: string;
  } | null;
  capabilities: {
    canEditUsers: boolean;
    canSuspendUsers: boolean;
    canBanUsers: boolean;
    canReactivateUsers: boolean;
    canSoftDeleteUsers: boolean;
    canManageSubscriptions: boolean;
    canReviewUsers: boolean;
    canViewTransactions: boolean;
  };
}

type PendingReasonAction =
  | { type: "suspend"; title: string; description: string }
  | { type: "ban"; title: string; description: string }
  | { type: "reactivate"; title: string; description: string }
  | { type: "under_review"; title: string; description: string }
  | { type: "delete"; title: string; description: string }
  | null;

export function UserRowActions({ user, subscription, capabilities }: UserRowActionsProps) {
  const router = useRouter();
  const [loadingLabel, setLoadingLabel] = useState<string | null>(null);
  const [pendingReasonAction, setPendingReasonAction] = useState<PendingReasonAction>(null);

  async function runAction(
    label: string,
    action: () => Promise<{ error?: string }>,
    successMessage: string
  ) {
    if (loadingLabel) return;
    setLoadingLabel(label);
    const result = await action();
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(successMessage);
      router.refresh();
    }
    setLoadingLabel(null);
  }

  async function handleRemoveAccess() {
    if (!subscription) return;
    if (!window.confirm(`Remove access for ${user.email}?`)) return;
    await runAction(
      "remove-access",
      () => deleteSubscriptionAction(subscription.id, user.id),
      "Access removed"
    );
  }

  async function handleReasonAction(reason: string) {
    if (!pendingReasonAction) return;

    if (pendingReasonAction.type === "suspend") {
      await runAction(
        "suspend-user",
        () => updateUserStatusAction(user.id, "suspended", reason),
        "User suspended"
      );
    } else if (pendingReasonAction.type === "ban") {
      await runAction(
        "ban-user",
        () => updateUserStatusAction(user.id, "banned", reason),
        "User banned"
      );
    } else if (pendingReasonAction.type === "reactivate") {
      await runAction(
        "reactivate-user",
        () => updateUserStatusAction(user.id, "active", reason),
        "User reactivated"
      );
    } else if (pendingReasonAction.type === "under_review") {
      await runAction(
        "mark-under-review",
        () => updateUserStatusAction(user.id, "under_review", reason),
        "User moved to review"
      );
    } else if (pendingReasonAction.type === "delete") {
      await runAction(
        "delete-user",
        () => deleteUserAction(user.id, reason),
        "User archived"
      );
    }
    setPendingReasonAction(null);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Control Center</DropdownMenuLabel>
          <DropdownMenuItem asChild>
            <Link href={`/admin/users/${user.id}`} className="cursor-pointer">
              <Eye className="mr-2 h-4 w-4" />
              View details
            </Link>
          </DropdownMenuItem>
          {capabilities.canViewTransactions ? (
            <DropdownMenuItem asChild>
              <Link href={`/admin/users/${user.id}/transactions`} className="cursor-pointer">
                <ReceiptText className="mr-2 h-4 w-4" />
                Transactions
              </Link>
            </DropdownMenuItem>
          ) : null}
          {capabilities.canManageSubscriptions ? (
            <DropdownMenuItem asChild>
              <Link href={`/admin/subscriptions?userId=${user.id}`} className="cursor-pointer">
                <ShieldCheck className="mr-2 h-4 w-4" />
                Full subscription editor
              </Link>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          {capabilities.canEditUsers ? (
            <>
              <DropdownMenuItem
                disabled={!!loadingLabel}
                onSelect={() =>
                  runAction(
                    user.is_email_verified ? "mark-unverified" : "mark-verified",
                    () => setUserVerificationAction(user.id, !user.is_email_verified),
                    user.is_email_verified ? "User marked unverified" : "User marked verified"
                  )
                }
              >
                {user.is_email_verified ? (
                  <BadgeX className="mr-2 h-4 w-4" />
                ) : (
                  <BadgeCheck className="mr-2 h-4 w-4" />
                )}
                {user.is_email_verified ? "Mark unverified" : "Mark verified"}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!!loadingLabel}
                onSelect={() =>
                  runAction(
                    "set-active-now",
                    () => setUserLastActiveNowAction(user.id),
                    "Last active updated"
                  )
                }
              >
                <Clock3 className="mr-2 h-4 w-4" />
                Set active now
              </DropdownMenuItem>
            </>
          ) : null}
          {capabilities.canManageSubscriptions ? (
            <>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger disabled={!!loadingLabel}>
                  <Crown className="mr-2 h-4 w-4" />
                  Grant access
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-44">
                  <DropdownMenuItem
                    onSelect={() =>
                      runAction(
                        "grant-free",
                        () => applySubscriptionPresetAction(user.id, "free"),
                        "Free access applied"
                      )
                    }
                  >
                    Free access
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() =>
                      runAction(
                        "grant-monthly",
                        () => applySubscriptionPresetAction(user.id, "monthly"),
                        "Monthly access applied"
                      )
                    }
                  >
                    Monthly access
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() =>
                      runAction(
                        "grant-yearly",
                        () => applySubscriptionPresetAction(user.id, "yearly"),
                        "Yearly access applied"
                      )
                    }
                  >
                    Yearly access
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              {subscription ? (
                <DropdownMenuItem disabled={!!loadingLabel} onSelect={handleRemoveAccess}>
                  <ShieldMinus className="mr-2 h-4 w-4" />
                  Remove access
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem disabled>
                  <Zap className="mr-2 h-4 w-4" />
                  No access record yet
                </DropdownMenuItem>
              )}
            </>
          ) : null}
          {capabilities.canSuspendUsers ||
          capabilities.canBanUsers ||
          capabilities.canReactivateUsers ||
          capabilities.canReviewUsers ||
          capabilities.canSoftDeleteUsers ? (
            <>
              <DropdownMenuSeparator />
              {capabilities.canSuspendUsers && user.status !== "suspended" ? (
                <DropdownMenuItem
                  onSelect={() =>
                    setPendingReasonAction({
                      type: "suspend",
                      title: "Suspend user",
                      description: `Capture why ${user.email} is being suspended.`,
                    })
                  }
                >
                  <ShieldAlert className="mr-2 h-4 w-4" />
                  Suspend user
                </DropdownMenuItem>
              ) : null}
              {capabilities.canBanUsers && user.status !== "banned" ? (
                <DropdownMenuItem
                  onSelect={() =>
                    setPendingReasonAction({
                      type: "ban",
                      title: "Ban user",
                      description: `Capture why ${user.email} is being banned.`,
                    })
                  }
                >
                  <ShieldBan className="mr-2 h-4 w-4" />
                  Ban user
                </DropdownMenuItem>
              ) : null}
              {capabilities.canReactivateUsers && user.status !== "active" ? (
                <DropdownMenuItem
                  onSelect={() =>
                    setPendingReasonAction({
                      type: "reactivate",
                      title: "Reactivate user",
                      description: `Capture why ${user.email} is being reactivated.`,
                    })
                  }
                >
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Reactivate user
                </DropdownMenuItem>
              ) : null}
              {capabilities.canReviewUsers && user.status !== "under_review" ? (
                <DropdownMenuItem
                  onSelect={() =>
                    setPendingReasonAction({
                      type: "under_review",
                      title: "Send user to review",
                      description: `Capture why ${user.email} is being sent to manual review.`,
                    })
                  }
                >
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  Send to review
                </DropdownMenuItem>
              ) : null}
              {capabilities.canSoftDeleteUsers ? (
                <DropdownMenuItem
                  disabled={!!loadingLabel}
                  onSelect={() =>
                    setPendingReasonAction({
                      type: "delete",
                      title: "Archive user",
                      description: `Capture why ${user.email} is being soft deleted.`,
                    })
                  }
                  className="text-red-600 focus:text-red-700"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Archive user
                </DropdownMenuItem>
              ) : null}
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <ReasonDialog
        open={!!pendingReasonAction}
        onOpenChange={(open) => !open && setPendingReasonAction(null)}
        title={pendingReasonAction?.title ?? "Confirm action"}
        description={pendingReasonAction?.description}
        confirmLabel="Confirm"
        loadingLabel="Saving..."
        onConfirm={handleReasonAction}
      />
    </>
  );
}
