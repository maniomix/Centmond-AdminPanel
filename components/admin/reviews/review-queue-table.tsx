"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { DataTable } from "@/components/shared/data-table";
import { Pagination } from "@/components/shared/pagination";
import { SearchFilter } from "@/components/shared/search-filter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ReasonDialog } from "@/components/admin/actions/reason-dialog";
import { formatDateShort } from "@/lib/utils";
import { toast } from "sonner";
import { updateReviewQueueItemAction } from "@/app/(admin)/admin/reviews/actions";

interface ReviewQueueRow {
  id: string;
  queueId: string;
  display_name: string;
  email: string;
  userStatus: string;
  queueStatus: string;
  priority: string;
  risk_score: number;
  risk_status: string | null;
  activeFlags: string[];
  last_active_at: string | null;
  latestReason?: string | null;
}

interface ReviewQueueTableProps {
  rows: ReviewQueueRow[];
  count: number;
  page: number;
  pageSize: number;
  search: string;
  queue: string;
}

const queueOptions = [
  { label: "Under Review", value: "under_review" },
  { label: "Escalated", value: "escalated" },
  { label: "Restricted", value: "restricted" },
  { label: "Resolved", value: "resolved" },
  { label: "All", value: "all" },
];

const statusVariant: Record<
  string,
  "warning" | "destructive" | "secondary" | "info" | "success"
> = {
  under_review: "warning",
  escalated: "info",
  restricted: "destructive",
  resolved: "secondary",
  approved: "success",
};

export function ReviewQueueTable({
  rows,
  count,
  page,
  pageSize,
  search,
  queue,
}: ReviewQueueTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const totalPages = Math.ceil(count / pageSize);
  const [pendingDecision, setPendingDecision] = useState<{
    userId: string;
    nextStatus: "escalated" | "restricted" | "approved" | "resolved";
  } | null>(null);

  function buildUrl(overrides: Record<string, string>) {
    const params = new URLSearchParams({
      page: String(page),
      search,
      queue,
      ...overrides,
    });
    return `${pathname}?${params.toString()}`;
  }

  const columns = [
    {
      key: "display_name",
      label: "User",
      render: (row: ReviewQueueRow) => (
        <div>
          <p className="font-medium text-neutral-900">{row.display_name}</p>
          <p className="text-xs text-neutral-500">{row.email}</p>
        </div>
      ),
    },
    {
      key: "queueStatus",
      label: "Queue State",
      render: (row: ReviewQueueRow) => (
        <div className="space-y-1">
          <Badge variant={statusVariant[row.queueStatus] ?? "secondary"} className="capitalize">
            {row.queueStatus.replace(/_/g, " ")}
          </Badge>
          <p className="text-xs text-neutral-500 capitalize">
            {row.priority} priority • user {row.userStatus.replace(/_/g, " ")}
          </p>
        </div>
      ),
    },
    {
      key: "risk_score",
      label: "Risk",
      render: (row: ReviewQueueRow) => (
        <div>
          <p className="font-medium text-neutral-900">{row.risk_score}</p>
          <p className="text-xs text-neutral-500">{row.risk_status ?? "Unspecified"}</p>
        </div>
      ),
    },
    {
      key: "activeFlags",
      label: "Active Flags",
      render: (row: ReviewQueueRow) =>
        row.activeFlags.length ? (
          <div className="flex flex-wrap gap-1">
            {row.activeFlags.slice(0, 2).map((flag) => (
              <Badge key={flag} variant="secondary" className="text-[11px]">
                {flag}
              </Badge>
            ))}
            {row.activeFlags.length > 2 ? (
              <Badge variant="secondary" className="text-[11px]">
                +{row.activeFlags.length - 2}
              </Badge>
            ) : null}
          </div>
        ) : (
          <span className="text-xs text-neutral-400">No active flags</span>
        ),
    },
    {
      key: "last_active_at",
      label: "Last Active",
      render: (row: ReviewQueueRow) => (
        <span className="text-sm text-neutral-500">
          {row.last_active_at ? formatDateShort(row.last_active_at) : "Never"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "",
      className: "w-56",
      render: (row: ReviewQueueRow) => (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/admin/users/${row.id}`}>Open</Link>
          </Button>
          {row.queueStatus !== "escalated" ? (
            <Button variant="ghost" size="sm" onClick={() => setPendingDecision({ userId: row.id, nextStatus: "escalated" })}>
              Escalate
            </Button>
          ) : null}
          {row.queueStatus !== "restricted" ? (
            <Button variant="ghost" size="sm" onClick={() => setPendingDecision({ userId: row.id, nextStatus: "restricted" })}>
              Restrict
            </Button>
          ) : null}
          {row.queueStatus !== "approved" ? (
            <Button variant="ghost" size="sm" onClick={() => setPendingDecision({ userId: row.id, nextStatus: "approved" })}>
              Approve
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <SearchFilter
        search={search}
        onSearchChange={(value) => router.push(buildUrl({ search: value, page: "1" }))}
        statusFilter={queue}
        onStatusChange={(value) => router.push(buildUrl({ queue: value, page: "1" }))}
        statusOptions={queueOptions.filter((option) => option.value !== "all")}
        placeholder="Search flagged users by name or email..."
      />
      <DataTable columns={columns} data={rows} emptyMessage="No users in this queue." />
      <Pagination
        page={page}
        totalPages={totalPages}
        onPageChange={(nextPage) => router.push(buildUrl({ page: String(nextPage) }))}
        count={count}
        pageSize={pageSize}
      />
      <ReasonDialog
        open={Boolean(pendingDecision)}
        onOpenChange={(open) => {
          if (!open) setPendingDecision(null);
        }}
        title={
          pendingDecision
            ? `Move queue item to ${pendingDecision.nextStatus.replace(/_/g, " ")}`
            : "Update queue"
        }
        description="Review decisions are fully audited and enforced server-side."
        confirmLabel="Save decision"
        loadingLabel="Saving..."
        onConfirm={async (reason) => {
          if (!pendingDecision) return;
          const result = await updateReviewQueueItemAction({
            userId: pendingDecision.userId,
            status: pendingDecision.nextStatus,
            priority:
              pendingDecision.nextStatus === "restricted"
                ? "high"
                : pendingDecision.nextStatus === "escalated"
                  ? "high"
                  : "normal",
            reason,
          });
          if ("error" in result && result.error) {
            toast.error(result.error);
            return;
          }
          toast.success("Review queue updated");
          setPendingDecision(null);
          router.refresh();
        }}
      />
    </div>
  );
}
