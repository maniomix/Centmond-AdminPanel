"use client";

import { useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { DataTable } from "@/components/shared/data-table";
import { Pagination } from "@/components/shared/pagination";
import { SearchFilter } from "@/components/shared/search-filter";
import { LiveRefresh } from "@/components/shared/live-refresh";
import { Badge } from "@/components/ui/badge";
import { formatDateShort } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { getSubscriptionBadgeVariant } from "@/lib/user-admin";
import type { UserRow } from "@/types";
import { UserBulkActions } from "@/components/admin/users/user-bulk-actions";
import { UserRowActions } from "./user-row-actions";

const verificationOptions = [
  { label: "Verified", value: "verified" },
  { label: "Unverified", value: "unverified" },
];

const statusVariant: Record<
  string,
  "success" | "warning" | "destructive" | "secondary"
> = {
  active: "success",
  suspended: "warning",
  banned: "destructive",
  flagged: "destructive",
  under_review: "warning",
  pending_verification: "secondary",
  soft_deleted: "destructive",
  inactive: "secondary",
};

const planVariant: Record<string, "default" | "secondary" | "success"> = {
  free: "secondary",
  monthly: "default",
  yearly: "success",
};

const emphasizedSubscriptionStatuses = new Set(["cancelled", "canceled", "expired", "past_due"]);

function humanizeIdentifier(value: string | null | undefined): string {
  const normalized = value?.trim();
  if (!normalized) return "Unknown";

  return normalized
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatPlatformLabel(value: string | null): string {
  if (!value?.trim()) return "Manual access";
  return humanizeIdentifier(value);
}

interface UsersTableProps {
  users: UserRow[];
  count: number;
  page: number;
  pageSize: number;
  search: string;
  verification: "all" | "verified" | "unverified";
  sortBy: string;
  sortOrder: "asc" | "desc";
  subscriptionByUserId: Record<
    string,
    {
      id: string;
      plan: string;
      status: string;
      updated_at: string;
      current_period_end: string | null;
      platform: string | null;
    }
  >;
  onlineUserIds: string[];
  activityByUserId: Record<
    string,
    {
      eventCount: number;
      topEvent: string | null;
    }
  >;
  allTags: Array<{
    id: string;
    key: string;
    label: string;
    color: string | null;
  }>;
  capabilities: {
    canEditUsers: boolean;
    canSuspendUsers: boolean;
    canBanUsers: boolean;
    canReactivateUsers: boolean;
    canSoftDeleteUsers: boolean;
    canManageSubscriptions: boolean;
    canManageTags: boolean;
    canRunBulkActions: boolean;
    canReviewUsers: boolean;
    canViewTransactions: boolean;
  };
}

export function UsersTable({
  users,
  count,
  page,
  pageSize,
  search,
  verification,
  sortBy,
  sortOrder,
  subscriptionByUserId,
  onlineUserIds,
  activityByUserId,
  allTags,
  capabilities,
}: UsersTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const totalPages = Math.ceil(count / pageSize);
  const onlineIdSet = useMemo(() => new Set(onlineUserIds), [onlineUserIds]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  const liveTables = useMemo(
    () => [{ table: "users" }, { table: "subscriptions" }, { table: "events" }],
    []
  );

  function buildUrl(overrides: Record<string, string>) {
    const params = new URLSearchParams({
      page: String(page),
      search,
      verification,
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

  function toggleUserSelection(userId: string) {
    setSelectedUserIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId]
    );
  }

  function selectAllOnPage() {
    setSelectedUserIds(users.map((user) => user.id));
  }

  function clearSelection() {
    setSelectedUserIds([]);
  }

  const columns = [
    {
      key: "select",
      label: "Select",
      className: "w-14",
      render: (row: UserRow) => (
        <input
          type="checkbox"
          checked={selectedUserIds.includes(row.id)}
          onChange={() => toggleUserSelection(row.id)}
          aria-label={`Select ${row.email}`}
          className="h-4 w-4 rounded border-neutral-300"
        />
      ),
    },
    {
      key: "display_name",
      label: "User",
      sortable: true,
      render: (row: UserRow) => (
        <div>
          <p className="flex items-center gap-2 font-medium text-neutral-900">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                onlineIdSet.has(row.id) ? "bg-green-500" : "bg-neutral-300"
              )}
            />
            {row.display_name?.trim() || "Unnamed"}
          </p>
          <p className="text-xs text-neutral-500">{row.email}</p>
        </div>
      ),
    },
    {
      key: "is_email_verified",
      label: "Verification",
      sortable: true,
      render: (row: UserRow) => (
        <Badge variant={row.is_email_verified ? "success" : "warning"} className="text-xs">
          {row.is_email_verified ? "Verified" : "Unverified"}
        </Badge>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (row: UserRow) => (
        <Badge variant={statusVariant[row.status] ?? "secondary"} className="capitalize text-xs">
          {humanizeIdentifier(row.status)}
        </Badge>
      ),
    },
    {
      key: "subscription",
      label: "Subscription",
      className: "align-top whitespace-nowrap",
      render: (row: UserRow) => {
        const subscription = subscriptionByUserId[row.id];
        if (!subscription) {
          return <span className="text-xs text-neutral-400">No subscription</span>;
        }
        const normalizedStatus = subscription.status.trim().toLowerCase();
        const showStatus =
          normalizedStatus !== subscription.plan.trim().toLowerCase();
        const showStatusBadge = showStatus && emphasizedSubscriptionStatuses.has(normalizedStatus);
        const statusLabel = humanizeIdentifier(subscription.status);
        const details = [
          !showStatusBadge && showStatus ? statusLabel : null,
          subscription.current_period_end
            ? `Until ${formatDateShort(subscription.current_period_end)}`
            : formatPlatformLabel(subscription.platform),
        ]
          .filter((value): value is string => Boolean(value?.trim().length))
          .join(" • ");

        return (
          <div className="flex items-center gap-2 whitespace-nowrap">
            <Badge
              variant={planVariant[subscription.plan] ?? "secondary"}
              className="w-fit capitalize text-xs"
            >
              {subscription.plan}
            </Badge>
            {showStatusBadge ? (
              <Badge variant={getSubscriptionBadgeVariant(subscription.status)} className="w-fit text-xs">
                {statusLabel}
              </Badge>
            ) : null}
            {details ? <span className="text-xs text-neutral-500">{humanizeIdentifier(details)}</span> : null}
          </div>
        );
      },
    },
    {
      key: "recent_activity",
      label: "7d Activity",
      className: "align-top",
      render: (row: UserRow) => {
        const activity = activityByUserId[row.id];
        if (!activity?.eventCount) {
          return <span className="text-xs text-neutral-400">Quiet</span>;
        }

        return (
          <div className="space-y-1">
            <p className="text-xs font-medium text-neutral-800">
              {activity.eventCount} event{activity.eventCount === 1 ? "" : "s"}
            </p>
            <p className="text-xs text-neutral-500">
              {activity.topEvent
                ? `Top: ${humanizeIdentifier(activity.topEvent)}`
                : "Active in app"}
            </p>
          </div>
        );
      },
    },
    {
      key: "created_at",
      label: "Joined",
      sortable: true,
      render: (row: UserRow) => (
        <span className="text-neutral-500">{formatDateShort(row.created_at)}</span>
      ),
    },
    {
      key: "last_active_at",
      label: "Last Seen",
      sortable: true,
      render: (row: UserRow) => (
        <span className="text-neutral-500">
          {row.last_active_at ? formatDateShort(row.last_active_at) : "Never"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "",
      className: "w-12",
      render: (row: UserRow) => (
        <UserRowActions
          user={row}
          subscription={subscriptionByUserId[row.id] ?? null}
          capabilities={capabilities}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <LiveRefresh tables={liveTables} intervalFallbackMs={3000} />
      {selectedUserIds.length ? (
        <UserBulkActions
          selectedUserIds={selectedUserIds}
          allTags={allTags}
          capabilities={{
            canSuspendUsers: capabilities.canSuspendUsers,
            canReactivateUsers: capabilities.canReactivateUsers,
            canManageTags: capabilities.canManageTags,
            canRunBulkActions: capabilities.canRunBulkActions,
            canReviewUsers: capabilities.canReviewUsers,
          }}
          onClearSelection={clearSelection}
        />
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <SearchFilter
          search={search}
          onSearchChange={(value) => router.push(buildUrl({ search: value, page: "1" }))}
          statusFilter={verification}
          onStatusChange={(value) => router.push(buildUrl({ verification: value, page: "1" }))}
          statusOptions={verificationOptions}
          placeholder="Search by name or email..."
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="text-xs font-medium text-neutral-500 hover:text-neutral-800"
            onClick={selectAllOnPage}
          >
            Select page
          </button>
          <button
            type="button"
            className="text-xs font-medium text-neutral-500 hover:text-neutral-800"
            onClick={clearSelection}
          >
            Clear
          </button>
        </div>
      </div>
      <DataTable
        columns={columns}
        data={users}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
      />
      <Pagination
        page={page}
        totalPages={totalPages}
        onPageChange={(p) => router.push(buildUrl({ page: String(p) }))}
        count={count}
        pageSize={pageSize}
      />
    </div>
  );
}
