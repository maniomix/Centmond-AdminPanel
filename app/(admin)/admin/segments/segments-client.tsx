"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookmarkPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DataTable } from "@/components/shared/data-table";
import { Pagination } from "@/components/shared/pagination";
import { SearchFilter } from "@/components/shared/search-filter";
import { LiveRefresh } from "@/components/shared/live-refresh";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDateShort } from "@/lib/utils";
import { formatRawEuro } from "@/lib/money";
import { cn } from "@/lib/utils";
import { deleteSegmentViewAction, saveSegmentViewAction } from "./actions";

type SegmentKey =
  | "all"
  | "paid_active"
  | "trial_ending_7d"
  | "inactive_paid_14d"
  | "unverified_users"
  | "high_spend_30d"
  | "no_subscription";

interface SegmentOption {
  key: SegmentKey;
  label: string;
  description: string;
  count: number;
}

interface SegmentTableRow {
  id: string;
  display_name: string;
  email: string;
  is_email_verified: boolean;
  plan: string;
  subscription_status: string;
  last_active_at: string | null;
  created_at: string;
  trial_end: string | null;
  current_period_end: string | null;
  income30d: number;
  expense30d: number;
  net30d: number;
}

interface SegmentsClientProps {
  rows: SegmentTableRow[];
  count: number;
  page: number;
  pageSize: number;
  search: string;
  segment: SegmentKey;
  sortBy: string;
  sortOrder: "asc" | "desc";
  options: SegmentOption[];
  savedViews: Array<{
    id: string;
    name: string;
    description: string | null;
    filters: Record<string, string> | null;
    is_shared: boolean;
  }>;
  canManageSavedViews: boolean;
}

const planVariant: Record<string, "default" | "secondary" | "success"> = {
  free: "secondary",
  monthly: "default",
  yearly: "success",
};

export function SegmentsClient({
  rows,
  count,
  page,
  pageSize,
  search,
  segment,
  sortBy,
  sortOrder,
  options,
  savedViews,
  canManageSavedViews,
}: SegmentsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const totalPages = Math.ceil(count / pageSize);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveDescription, setSaveDescription] = useState("");
  const [saveSubmitting, setSaveSubmitting] = useState(false);

  const liveTables = useMemo(
    () => [{ table: "users" }, { table: "subscriptions" }, { table: "transactions" }],
    []
  );

  function buildUrl(overrides: Record<string, string>) {
    const params = new URLSearchParams({
      page: String(page),
      search,
      segment,
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

  async function handleSaveView() {
    setSaveSubmitting(true);
    const result = await saveSegmentViewAction({
      name: saveName,
      description: saveDescription,
      filters: {
        segment,
        search,
        sortBy,
        sortOrder,
      },
      isShared: false,
    });
    setSaveSubmitting(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Saved view created");
    setSaveOpen(false);
    setSaveName("");
    setSaveDescription("");
    router.refresh();
  }

  function applySavedView(view: SegmentsClientProps["savedViews"][number]) {
    const filters = view.filters ?? {};
    router.push(
      buildUrl({
        page: "1",
        search: filters.search ?? "",
        segment: filters.segment ?? "all",
        sortBy: filters.sortBy ?? "expense30d",
        sortOrder: filters.sortOrder ?? "desc",
      })
    );
  }

  const columns = [
    {
      key: "display_name",
      label: "User",
      sortable: true,
      render: (row: SegmentTableRow) => (
        <div>
          <p className="font-medium text-neutral-900">{row.display_name}</p>
          <p className="text-xs text-neutral-500">{row.email}</p>
        </div>
      ),
    },
    {
      key: "plan",
      label: "Plan",
      sortable: true,
      render: (row: SegmentTableRow) => (
        <div className="flex items-center gap-2">
          <Badge variant={planVariant[row.plan] ?? "secondary"} className="capitalize text-xs">
            {row.plan}
          </Badge>
          <span className="text-xs text-neutral-500 capitalize">{row.subscription_status}</span>
        </div>
      ),
    },
    {
      key: "is_email_verified",
      label: "Verification",
      render: (row: SegmentTableRow) => (
        <Badge variant={row.is_email_verified ? "success" : "warning"} className="text-xs">
          {row.is_email_verified ? "Verified" : "Unverified"}
        </Badge>
      ),
    },
    {
      key: "expense30d",
      label: "Expense 30d",
      sortable: true,
      render: (row: SegmentTableRow) => (
        <span className="font-medium text-red-600">-{formatRawEuro(row.expense30d)} €</span>
      ),
    },
    {
      key: "net30d",
      label: "Net 30d",
      sortable: true,
      render: (row: SegmentTableRow) => (
        <span className={cn("font-medium", row.net30d >= 0 ? "text-green-600" : "text-red-600")}>
          {(row.net30d >= 0 ? "+" : "") + formatRawEuro(row.net30d)} €
        </span>
      ),
    },
    {
      key: "last_active_at",
      label: "Last Active",
      sortable: true,
      render: (row: SegmentTableRow) => (
        <span className="text-neutral-500">
          {row.last_active_at ? formatDateShort(row.last_active_at) : "Never"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "",
      className: "w-40",
      render: (row: SegmentTableRow) => (
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link href={`/admin/users/${row.id}`}>User</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href={`/admin/subscriptions?userId=${row.id}`}>Subscription</Link>
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <LiveRefresh tables={liveTables} intervalFallbackMs={3000} />

      <div className="grid grid-cols-3 gap-3">
        {options
          .filter((option) => option.key !== "all")
          .map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => router.push(buildUrl({ segment: option.key, page: "1" }))}
              className={cn(
                "rounded-lg border p-3 text-left transition-colors",
                segment === option.key
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-200 bg-white text-neutral-900 hover:border-neutral-300"
              )}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{option.label}</p>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-semibold",
                    segment === option.key
                      ? "bg-white/15 text-white"
                      : "bg-neutral-100 text-neutral-700"
                  )}
                >
                  {option.count}
                </span>
              </div>
              <p
                className={cn(
                  "mt-1.5 text-xs",
                  segment === option.key ? "text-white/80" : "text-neutral-500"
                )}
              >
                {option.description}
              </p>
            </button>
          ))}
      </div>

      {canManageSavedViews ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-neutral-900">Saved Views</p>
              <p className="text-xs text-neutral-500">
                Persist segment filters for recurring operational workflows.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setSaveOpen(true)}>
              <BookmarkPlus className="h-4 w-4" />
              Save current view
            </Button>
          </div>
          {savedViews.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {savedViews.map((view) => (
                <div
                  key={view.id}
                  className="flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5"
                >
                  <button
                    type="button"
                    className="text-sm text-neutral-800 hover:text-neutral-950"
                    onClick={() => applySavedView(view)}
                  >
                    {view.name}
                  </button>
                  <button
                    type="button"
                    className="text-neutral-400 hover:text-red-600"
                    onClick={async () => {
                      const result = await deleteSegmentViewAction(view.id, view.name);
                      if (result.error) {
                        toast.error(result.error);
                      } else {
                        toast.success("Saved view deleted");
                        router.refresh();
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-neutral-400">No saved views yet.</p>
          )}
        </div>
      ) : null}

      <SearchFilter
        search={search}
        onSearchChange={(value) => router.push(buildUrl({ search: value, page: "1" }))}
        statusFilter={segment}
        onStatusChange={(value) => router.push(buildUrl({ segment: value, page: "1" }))}
        statusOptions={options
          .filter((option) => option.key !== "all")
          .map((option) => ({
            value: option.key,
            label: `${option.label} (${option.count})`,
          }))}
        placeholder="Search users in selected segment..."
      />

      <DataTable
        columns={columns}
        data={rows}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        emptyMessage="No users found for this segment."
      />

      <Pagination
        page={page}
        totalPages={totalPages}
        onPageChange={(p) => router.push(buildUrl({ page: String(p) }))}
        count={count}
        pageSize={pageSize}
      />

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save current view</DialogTitle>
            <DialogDescription>
              Save the current segment, search, and sorting state for repeat workflows.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={saveName} onChange={(event) => setSaveName(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                rows={3}
                value={saveDescription}
                onChange={(event) => setSaveDescription(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveView} disabled={saveSubmitting || !saveName.trim()}>
              {saveSubmitting ? "Saving..." : "Save view"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
