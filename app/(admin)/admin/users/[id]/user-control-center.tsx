"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Clock3,
  Crown,
  ShieldAlert,
  ShieldBan,
  ShieldCheck,
  ShieldMinus,
  Trash2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { ReasonDialog } from "@/components/admin/actions/reason-dialog";
import { DeleteDialog } from "@/components/shared/delete-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSubscriptionBadgeVariant } from "@/lib/user-admin";
import type { SubscriptionRow, UserRow } from "@/types";
import {
  applySubscriptionPresetAction,
  deleteSubscriptionAction,
  deleteUserAction,
  setUserLastActiveNowAction,
  setUserVerificationAction,
  updateUserStatusAction,
  upsertUserSubscriptionAction,
} from "../actions";

interface SubscriptionFormState {
  plan: string;
  status: string;
  platform: string;
  trial_start: string;
  trial_end: string;
  subscription_start: string;
  subscription_end: string;
  current_period_start: string;
  current_period_end: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  apple_transaction_id: string;
}

interface UserControlCenterProps {
  user: Pick<UserRow, "id" | "email" | "display_name" | "is_email_verified" | "status">;
  subscription: SubscriptionRow | null;
  capabilities: {
    canEditUsers: boolean;
    canSuspendUsers: boolean;
    canBanUsers: boolean;
    canReactivateUsers: boolean;
    canSoftDeleteUsers: boolean;
    canManageSubscriptions: boolean;
    canReviewUsers: boolean;
  };
}

type PendingReasonAction =
  | { type: "suspend"; title: string; description: string }
  | { type: "ban"; title: string; description: string }
  | { type: "reactivate"; title: string; description: string }
  | { type: "under_review"; title: string; description: string }
  | { type: "delete"; title: string; description: string }
  | null;

function toLocalInput(value: string | null): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 16);
}

function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function buildDefaultFormState(subscription: SubscriptionRow | null): SubscriptionFormState {
  return {
    plan: subscription?.plan ?? "free",
    status: subscription?.status ?? "active",
    platform: subscription?.platform ?? "admin",
    trial_start: toLocalInput(subscription?.trial_start ?? null),
    trial_end: toLocalInput(subscription?.trial_end ?? null),
    subscription_start: toLocalInput(subscription?.subscription_start ?? null),
    subscription_end: toLocalInput(subscription?.subscription_end ?? null),
    current_period_start: toLocalInput(subscription?.current_period_start ?? null),
    current_period_end: toLocalInput(subscription?.current_period_end ?? null),
    stripe_customer_id: subscription?.stripe_customer_id ?? "",
    stripe_subscription_id: subscription?.stripe_subscription_id ?? "",
    apple_transaction_id: subscription?.apple_transaction_id ?? "",
  };
}

export function UserControlCenter({
  user,
  subscription,
  capabilities,
}: UserControlCenterProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState<string | null>(null);
  const [pendingReasonAction, setPendingReasonAction] = useState<PendingReasonAction>(null);
  const [form, setForm] = useState<SubscriptionFormState>(() =>
    buildDefaultFormState(subscription)
  );

  async function runAction(
    label: string,
    action: () => Promise<{ error?: string }>,
    successMessage: string,
    onSuccess?: () => void
  ) {
    if (loadingLabel) return;
    setLoadingLabel(label);
    const result = await action();
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(successMessage);
      onSuccess?.();
      router.refresh();
    }
    setLoadingLabel(null);
  }

  function openDialog() {
    setForm(buildDefaultFormState(subscription));
    setDialogOpen(true);
  }

  function applyPresetToForm(preset: "free" | "monthly" | "yearly") {
    const now = new Date();
    const end = new Date(now);
    if (preset === "monthly") {
      end.setDate(end.getDate() + 30);
    } else if (preset === "yearly") {
      end.setFullYear(end.getFullYear() + 1);
    }

    setForm((prev) => ({
      ...prev,
      plan: preset,
      status: "active",
      platform: "admin",
      trial_start: "",
      trial_end: "",
      subscription_start: now.toISOString().slice(0, 16),
      subscription_end: preset === "free" ? "" : end.toISOString().slice(0, 16),
      current_period_start: now.toISOString().slice(0, 16),
      current_period_end: preset === "free" ? "" : end.toISOString().slice(0, 16),
      stripe_customer_id: "",
      stripe_subscription_id: "",
      apple_transaction_id: "",
    }));
    setDialogOpen(true);
  }

  async function handleSave() {
    await runAction(
      "save-subscription",
      () =>
        upsertUserSubscriptionAction(user.id, {
          plan: form.plan,
          status: form.status,
          platform: form.platform || null,
          trial_start: fromLocalInput(form.trial_start),
          trial_end: fromLocalInput(form.trial_end),
          subscription_start: fromLocalInput(form.subscription_start),
          subscription_end: fromLocalInput(form.subscription_end),
          current_period_start: fromLocalInput(form.current_period_start),
          current_period_end: fromLocalInput(form.current_period_end),
          stripe_customer_id: form.stripe_customer_id || null,
          stripe_subscription_id: form.stripe_subscription_id || null,
          apple_transaction_id: form.apple_transaction_id || null,
        }),
      subscription ? "Access updated" : "Access granted",
      () => setDialogOpen(false)
    );
  }

  async function handleRemoveAccess() {
    if (!subscription) return;
    const result = await deleteSubscriptionAction(subscription.id, user.id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Access removed");
    router.refresh();
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
        "under-review-user",
        () => updateUserStatusAction(user.id, "under_review", reason),
        "User sent to review"
      );
    } else if (pendingReasonAction.type === "delete") {
      await runAction(
        "archive-user",
        () => deleteUserAction(user.id, reason),
        "User archived",
        () => {
          router.push("/admin/users");
          router.refresh();
        }
      );
    }

    setPendingReasonAction(null);
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Control Center</CardTitle>
          <CardDescription>Fast actions for access, trust and recovery.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Live access state
                </p>
                <p className="mt-1 text-sm font-semibold text-neutral-900">
                  {subscription ? `${subscription.plan} plan` : "No access record"}
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  {subscription
                    ? `Status: ${subscription.status}${subscription.platform ? ` • ${subscription.platform}` : ""}`
                    : "You can grant access instantly or open the full editor."}
                </p>
              </div>
              <Badge
                variant={
                  subscription ? getSubscriptionBadgeVariant(subscription.status) : "secondary"
                }
                className="capitalize"
              >
                {subscription ? subscription.status : "none"}
              </Badge>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {capabilities.canEditUsers ? (
              <>
                <Button
                  variant="outline"
                  onClick={() =>
                    runAction(
                      user.is_email_verified ? "unverify-user" : "verify-user",
                      () => setUserVerificationAction(user.id, !user.is_email_verified),
                      user.is_email_verified ? "User marked unverified" : "User marked verified"
                    )
                  }
                  disabled={!!loadingLabel}
                  className="justify-start"
                >
                  <ShieldCheck className="h-4 w-4" />
                  {user.is_email_verified ? "Mark unverified" : "Verify email"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    runAction(
                      "set-active-now",
                      () => setUserLastActiveNowAction(user.id),
                      "Last active updated"
                    )
                  }
                  disabled={!!loadingLabel}
                  className="justify-start"
                >
                  <Clock3 className="h-4 w-4" />
                  Set active now
                </Button>
              </>
            ) : null}

            {capabilities.canManageSubscriptions ? (
              <>
                <Button
                  variant="secondary"
                  onClick={() => applyPresetToForm("free")}
                  disabled={!!loadingLabel}
                  className="justify-start"
                >
                  <Zap className="h-4 w-4" />
                  Grant free access
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => applyPresetToForm("monthly")}
                  disabled={!!loadingLabel}
                  className="justify-start"
                >
                  <Crown className="h-4 w-4" />
                  Grant monthly access
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => applyPresetToForm("yearly")}
                  disabled={!!loadingLabel}
                  className="justify-start"
                >
                  <Crown className="h-4 w-4" />
                  Grant yearly access
                </Button>
                <Button
                  variant="default"
                  onClick={openDialog}
                  disabled={!!loadingLabel}
                  className="justify-start"
                >
                  <ShieldCheck className="h-4 w-4" />
                  {subscription ? "Open access editor" : "Create custom access"}
                </Button>
              </>
            ) : null}

            {capabilities.canSuspendUsers && user.status !== "suspended" ? (
              <Button
                variant="outline"
                onClick={() =>
                  setPendingReasonAction({
                    type: "suspend",
                    title: "Suspend user",
                    description: `Capture why ${user.email} is being suspended.`,
                  })
                }
                disabled={!!loadingLabel}
                className="justify-start"
              >
                <ShieldAlert className="h-4 w-4" />
                Suspend user
              </Button>
            ) : null}
            {capabilities.canBanUsers && user.status !== "banned" ? (
              <Button
                variant="outline"
                onClick={() =>
                  setPendingReasonAction({
                    type: "ban",
                    title: "Ban user",
                    description: `Capture why ${user.email} is being banned.`,
                  })
                }
                disabled={!!loadingLabel}
                className="justify-start"
              >
                <ShieldBan className="h-4 w-4" />
                Ban user
              </Button>
            ) : null}
            {capabilities.canReactivateUsers && user.status !== "active" ? (
              <Button
                variant="outline"
                onClick={() =>
                  setPendingReasonAction({
                    type: "reactivate",
                    title: "Reactivate user",
                    description: `Capture why ${user.email} is being reactivated.`,
                  })
                }
                disabled={!!loadingLabel}
                className="justify-start"
              >
                <ShieldCheck className="h-4 w-4" />
                Reactivate user
              </Button>
            ) : null}
            {capabilities.canReviewUsers && user.status !== "under_review" ? (
              <Button
                variant="outline"
                onClick={() =>
                  setPendingReasonAction({
                    type: "under_review",
                    title: "Send user to review",
                    description: `Capture why ${user.email} is being sent to manual review.`,
                  })
                }
                disabled={!!loadingLabel}
                className="justify-start"
              >
                <AlertTriangle className="h-4 w-4" />
                Send to review
              </Button>
            ) : null}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="outline" asChild className="justify-start">
              <Link href={`/admin/users/${user.id}/transactions`}>Open transactions</Link>
            </Button>
            <Button variant="outline" asChild className="justify-start">
              <Link href={`/admin/activity-logs?user=${encodeURIComponent(user.email)}`}>
                Open activity logs
              </Link>
            </Button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {subscription && capabilities.canManageSubscriptions ? (
              <DeleteDialog
                title="Remove access"
                description="This removes the latest subscription record for this user."
                confirmLabel="Remove access"
                loadingLabel="Removing..."
                confirmClassName="bg-red-600 hover:bg-red-700"
                onConfirm={handleRemoveAccess}
                trigger={
                  <Button variant="outline" className="w-full justify-start text-red-600">
                    <ShieldMinus className="h-4 w-4" />
                    Remove access
                  </Button>
                }
              />
            ) : (
              <Button variant="outline" disabled className="justify-start">
                <ShieldMinus className="h-4 w-4" />
                {capabilities.canManageSubscriptions ? "No access to remove" : "No subscription permissions"}
              </Button>
            )}
            {capabilities.canSoftDeleteUsers ? (
              <Button
                variant="outline"
                className="w-full justify-start text-red-600"
                onClick={() =>
                  setPendingReasonAction({
                    type: "delete",
                    title: "Archive user",
                    description: `Capture why ${user.email} is being soft deleted.`,
                  })
                }
              >
                <Trash2 className="h-4 w-4" />
                Archive user
              </Button>
            ) : (
              <Button variant="outline" disabled className="justify-start">
                <Trash2 className="h-4 w-4" />
                No archive permissions
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{subscription ? "Edit access" : "Grant access"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Plan</Label>
                <Input
                  value={form.plan}
                  onChange={(e) => setForm((prev) => ({ ...prev, plan: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Input
                  value={form.status}
                  onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Platform</Label>
                <Input
                  value={form.platform}
                  onChange={(e) => setForm((prev) => ({ ...prev, platform: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Current period start</Label>
                <Input
                  type="datetime-local"
                  value={form.current_period_start}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, current_period_start: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Current period end</Label>
                <Input
                  type="datetime-local"
                  value={form.current_period_end}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, current_period_end: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Subscription start</Label>
                <Input
                  type="datetime-local"
                  value={form.subscription_start}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, subscription_start: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Subscription end</Label>
                <Input
                  type="datetime-local"
                  value={form.subscription_end}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, subscription_end: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Trial start</Label>
                <Input
                  type="datetime-local"
                  value={form.trial_start}
                  onChange={(e) => setForm((prev) => ({ ...prev, trial_start: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Trial end</Label>
                <Input
                  type="datetime-local"
                  value={form.trial_end}
                  onChange={(e) => setForm((prev) => ({ ...prev, trial_end: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Stripe Customer ID</Label>
                <Input
                  value={form.stripe_customer_id}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, stripe_customer_id: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Stripe Subscription ID</Label>
                <Input
                  value={form.stripe_subscription_id}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, stripe_subscription_id: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Apple Transaction ID</Label>
                <Input
                  value={form.apple_transaction_id}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, apple_transaction_id: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  runAction(
                    "preset-free",
                    () => applySubscriptionPresetAction(user.id, "free"),
                    "Free access applied",
                    () => setDialogOpen(false)
                  )
                }
                disabled={!!loadingLabel}
              >
                Quick free
              </Button>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={!!loadingLabel}>
                {loadingLabel === "save-subscription" ? "Saving..." : "Save access"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
