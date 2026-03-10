"use client";

import { usePathname, useRouter } from "next/navigation";
import { DataTable } from "@/components/shared/data-table";
import { Pagination } from "@/components/shared/pagination";
import { SearchFilter } from "@/components/shared/search-filter";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

interface AuditLogRecord {
  id: string;
  action_type: string;
  category: string;
  severity: string;
  reason: string | null;
  actor_admin_id: string | null;
  target_entity_type: string | null;
  target_entity_id: string | null;
  target_summary: string | null;
  created_at: string;
  actorLabel: string;
}

interface AuditLogTableProps {
  logs: AuditLogRecord[];
  count: number;
  page: number;
  pageSize: number;
  search: string;
  category: string;
}

const categoryOptions = [
  { label: "Auth", value: "auth" },
  { label: "Admin", value: "admin" },
  { label: "User", value: "user" },
  { label: "Subscription", value: "subscription" },
  { label: "Billing", value: "billing" },
  { label: "Support", value: "support" },
  { label: "Risk", value: "risk" },
  { label: "Search", value: "search" },
  { label: "Security", value: "security" },
  { label: "Bulk", value: "bulk" },
];

const severityVariant: Record<string, "secondary" | "warning" | "destructive" | "info"> = {
  info: "info",
  warning: "warning",
  critical: "destructive",
};

export function AuditLogTable({
  logs,
  count,
  page,
  pageSize,
  search,
  category,
}: AuditLogTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const totalPages = Math.ceil(count / pageSize);

  function buildUrl(overrides: Record<string, string>) {
    const params = new URLSearchParams({
      page: String(page),
      search,
      category,
      ...overrides,
    });
    return `${pathname}?${params.toString()}`;
  }

  const columns = [
    {
      key: "action_type",
      label: "Action",
      render: (row: AuditLogRecord) => (
        <div>
          <p className="text-sm font-medium text-neutral-900">{row.action_type}</p>
          <p className="text-xs text-neutral-500">{row.actorLabel}</p>
        </div>
      ),
    },
    {
      key: "category",
      label: "Category",
      render: (row: AuditLogRecord) => (
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{row.category}</Badge>
          <Badge variant={severityVariant[row.severity] ?? "secondary"}>{row.severity}</Badge>
        </div>
      ),
    },
    {
      key: "target_summary",
      label: "Target",
      render: (row: AuditLogRecord) => (
        <div>
          <p className="text-sm text-neutral-800">
            {row.target_summary ?? row.target_entity_id ?? "-"}
          </p>
          <p className="text-xs text-neutral-500">{row.target_entity_type ?? "-"}</p>
        </div>
      ),
    },
    {
      key: "reason",
      label: "Reason",
      render: (row: AuditLogRecord) => (
        <span className="text-sm text-neutral-600">{row.reason ?? "—"}</span>
      ),
    },
    {
      key: "created_at",
      label: "At",
      render: (row: AuditLogRecord) => (
        <span className="text-sm text-neutral-500">{formatDate(row.created_at)}</span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <SearchFilter
        search={search}
        onSearchChange={(value) => router.push(buildUrl({ search: value, page: "1" }))}
        statusFilter={category}
        onStatusChange={(value) => router.push(buildUrl({ category: value, page: "1" }))}
        statusOptions={categoryOptions}
        placeholder="Search by action, target, actor, reason..."
      />
      <DataTable columns={columns} data={logs} emptyMessage="No audit logs found." />
      <Pagination
        page={page}
        totalPages={totalPages}
        onPageChange={(nextPage) => router.push(buildUrl({ page: String(nextPage) }))}
        count={count}
        pageSize={pageSize}
      />
    </div>
  );
}
