"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MoreHorizontal, Pencil } from "lucide-react";
import { DataTable } from "@/components/shared/data-table";
import { LiveRefresh } from "@/components/shared/live-refresh";
import { Pagination } from "@/components/shared/pagination";
import { SearchFilter } from "@/components/shared/search-filter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateShort } from "@/lib/utils";
import { toast } from "sonner";
import type { SubscriptionRow } from "@/types";
import { updateSubscriptionAction } from "./actions";

function toLocalInput(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 16);
}

function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

const planVariant: Record<string, "default" | "secondary" | "success"> = {
  free: "secondary",
  monthly: "default",
  yearly: "success",
};

const statusVariant: Record<string, "success" | "warning" | "secondary" | "destructive"> = {
  active: "success",
  trialing: "warning",
  cancelled: "destructive",
  free: "secondary",
};

interface SubscriptionsTableProps {
  subscriptions: SubscriptionRow[];
  usersById: Record<string, { id: string; email: string; display_name: string | null }>;
  count: number;
  page: number;
  pageSize: number;
  search: string;
  userId: string;
  status: string;
  plan: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
  planOptions: string[];
  statusOptions: string[];
}

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

export function SubscriptionsTable({
  subscriptions,
  usersById,
  count,
  page,
  pageSize,
  search,
  userId,
  status,
  plan,
  sortBy,
  sortOrder,
  planOptions,
  statusOptions,
}: SubscriptionsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const totalPages = Math.ceil(count / pageSize);

  const [editTarget, setEditTarget] = useState<SubscriptionRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<SubscriptionFormState>({
    plan: "",
    status: "",
    platform: "",
    trial_start: "",
    trial_end: "",
    subscription_start: "",
    subscription_end: "",
    current_period_start: "",
    current_period_end: "",
    stripe_customer_id: "",
    stripe_subscription_id: "",
    apple_transaction_id: "",
  });

  const liveTables = useMemo(
    () => [{ table: "subscriptions" }, { table: "users" }],
    []
  );

  function buildUrl(overrides: Record<string, string>) {
    const params = new URLSearchParams({
      page: String(page),
      search,
      userId,
      status,
      plan,
      sortBy,
      sortOrder,
      ...overrides,
    });
    return `${pathname}?${params.toString()}`;
  }

  function handleSort(key: string) {
    const newOrder = sortBy === key && sortOrder === "asc" ? "desc" : "asc";
    router.push(buildUrl({ sortBy: key, sortOrder: newOrder, page: "1" }));
  }

  function openEdit(subscription: SubscriptionRow) {
    setEditTarget(subscription);
    setForm({
      plan: subscription.plan,
      status: subscription.status,
      platform: subscription.platform ?? "",
      trial_start: toLocalInput(subscription.trial_start),
      trial_end: toLocalInput(subscription.trial_end),
      subscription_start: toLocalInput(subscription.subscription_start),
      subscription_end: toLocalInput(subscription.subscription_end),
      current_period_start: toLocalInput(subscription.current_period_start),
      current_period_end: toLocalInput(subscription.current_period_end),
      stripe_customer_id: subscription.stripe_customer_id ?? "",
      stripe_subscription_id: subscription.stripe_subscription_id ?? "",
      apple_transaction_id: subscription.apple_transaction_id ?? "",
    });
  }

  async function handleSave() {
    if (!editTarget) return;
    if (!form.plan.trim() || !form.status.trim()) {
      toast.error("Plan and status are required");
      return;
    }

    setSaving(true);
    const result = await updateSubscriptionAction(editTarget.id, editTarget.user_id, {
      plan: form.plan.trim(),
      status: form.status.trim(),
      platform: form.platform.trim() || null,
      trial_start: fromLocalInput(form.trial_start),
      trial_end: fromLocalInput(form.trial_end),
      subscription_start: fromLocalInput(form.subscription_start),
      subscription_end: fromLocalInput(form.subscription_end),
      current_period_start: fromLocalInput(form.current_period_start),
      current_period_end: fromLocalInput(form.current_period_end),
      stripe_customer_id: form.stripe_customer_id.trim() || null,
      stripe_subscription_id: form.stripe_subscription_id.trim() || null,
      apple_transaction_id: form.apple_transaction_id.trim() || null,
    });

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Subscription updated");
      setEditTarget(null);
      router.refresh();
    }

    setSaving(false);
  }

  const columns = [
    {
      key: "user_id",
      label: "User",
      render: (row: SubscriptionRow) => {
        const user = usersById[row.user_id];
        if (!user) return <span className="text-xs text-neutral-400">Unknown user</span>;
        return (
          <div>
            <p className="font-medium text-neutral-900">
              {(user.display_name ?? "Unnamed").trim()}
            </p>
            <p className="text-xs text-neutral-500">{user.email}</p>
          </div>
        );
      },
    },
    {
      key: "plan",
      label: "Plan",
      sortable: true,
      render: (row: SubscriptionRow) => (
        <Badge variant={planVariant[row.plan] ?? "secondary"} className="capitalize text-xs">
          {row.plan}
        </Badge>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (row: SubscriptionRow) => (
        <Badge variant={statusVariant[row.status] ?? "secondary"} className="capitalize text-xs">
          {row.status}
        </Badge>
      ),
    },
    {
      key: "platform",
      label: "Platform",
      sortable: true,
      render: (row: SubscriptionRow) => (
        <span className="text-sm text-neutral-600">{row.platform ?? "-"}</span>
      ),
    },
    {
      key: "current_period_end",
      label: "Current Period End",
      sortable: true,
      render: (row: SubscriptionRow) => (
        <span className="text-sm text-neutral-600">
          {row.current_period_end ? formatDateShort(row.current_period_end) : "-"}
        </span>
      ),
    },
    {
      key: "updated_at",
      label: "Updated",
      sortable: true,
      render: (row: SubscriptionRow) => (
        <span className="text-sm text-neutral-600">{formatDateShort(row.updated_at)}</span>
      ),
    },
    {
      key: "actions",
      label: "",
      className: "w-12",
      render: (row: SubscriptionRow) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="cursor-pointer" onSelect={() => openEdit(row)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit subscription
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <>
      <LiveRefresh tables={liveTables} intervalFallbackMs={30000} />
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <SearchFilter
              search={search}
              onSearchChange={(value) => router.push(buildUrl({ search: value, page: "1" }))}
              statusFilter={status}
              onStatusChange={(value) => router.push(buildUrl({ status: value, page: "1" }))}
              statusOptions={statusOptions.map((value) => ({ label: value, value }))}
              placeholder="Search by user name or email..."
            />
          </div>
          <Select
            value={plan}
            onValueChange={(value) => router.push(buildUrl({ plan: value, page: "1" }))}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All plans" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All plans</SelectItem>
              {planOptions.map((value) => (
                <SelectItem key={value} value={value} className="capitalize">
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {userId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(buildUrl({ userId: "", page: "1" }))}
            >
              Clear user filter
            </Button>
          )}
        </div>
        <DataTable
          columns={columns}
          data={subscriptions}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={handleSort}
          emptyMessage="No subscriptions found."
        />
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={(p) => router.push(buildUrl({ page: String(p) }))}
          count={count}
          pageSize={pageSize}
        />
      </div>

      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Subscription</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-3 gap-4">
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

            <div className="grid grid-cols-2 gap-4">
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

            <div className="grid grid-cols-3 gap-4">
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

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditTarget(null)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
