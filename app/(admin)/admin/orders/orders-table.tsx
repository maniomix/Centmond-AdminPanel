"use client";

import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Eye, MoreHorizontal } from "lucide-react";
import { DataTable } from "@/components/shared/data-table";
import { Pagination } from "@/components/shared/pagination";
import { SearchFilter } from "@/components/shared/search-filter";
import { LiveRefresh } from "@/components/shared/live-refresh";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDateShort } from "@/lib/utils";
import type { OrderRow } from "@/types";

const statusOptions = [
  { label: "Pending", value: "pending" },
  { label: "Processing", value: "processing" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Refunded", value: "refunded" },
];

const statusVariant: Record<string, "warning" | "info" | "success" | "secondary" | "destructive"> = {
  pending: "warning",
  processing: "info",
  completed: "success",
  cancelled: "secondary",
  refunded: "destructive",
};

interface OrdersTableProps {
  orders: OrderRow[];
  count: number;
  page: number;
  pageSize: number;
  search: string;
  status: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
}

export function OrdersTable({ orders, count, page, pageSize, search, status, sortBy, sortOrder }: OrdersTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const totalPages = Math.ceil(count / pageSize);

  function buildUrl(overrides: Record<string, string>) {
    const params = new URLSearchParams({ page: String(page), search, status, sortBy, sortOrder, ...overrides });
    return `${pathname}?${params.toString()}`;
  }

  function handleSort(key: string) {
    const newOrder = sortBy === key && sortOrder === "asc" ? "desc" : "asc";
    router.push(buildUrl({ sortBy: key, sortOrder: newOrder, page: "1" }));
  }

  const columns = [
    {
      key: "order_number",
      label: "Order #",
      sortable: true,
      render: (row: OrderRow) => (
        <span className="font-medium text-neutral-900">#{row.order_number}</span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row: OrderRow) => (
        <Badge variant={statusVariant[row.status] ?? "secondary"} className="capitalize text-xs">
          {row.status}
        </Badge>
      ),
    },
    {
      key: "total_amount",
      label: "Amount",
      sortable: true,
      render: (row: OrderRow) => (
        <span className="font-medium text-neutral-900">
          {row.currency} {row.total_amount.toFixed(2)}
        </span>
      ),
    },
    {
      key: "user_id",
      label: "User ID",
      render: (row: OrderRow) => (
        <Link href={`/admin/users/${row.user_id}`} className="text-xs text-blue-600 hover:underline font-mono">
          {row.user_id.slice(0, 8)}...
        </Link>
      ),
    },
    {
      key: "created_at",
      label: "Created",
      sortable: true,
      render: (row: OrderRow) => (
        <span className="text-neutral-500">{formatDateShort(row.created_at)}</span>
      ),
    },
    {
      key: "actions",
      label: "",
      className: "w-12",
      render: (row: OrderRow) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/admin/orders/${row.id}`} className="cursor-pointer">
                <Eye className="mr-2 h-4 w-4" />
                View details
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <LiveRefresh tables={[{ table: "orders" }]} intervalFallbackMs={3000} />
      <SearchFilter
        search={search}
        onSearchChange={(v) => router.push(buildUrl({ search: v, page: "1" }))}
        statusFilter={status}
        onStatusChange={(v) => router.push(buildUrl({ status: v, page: "1" }))}
        statusOptions={statusOptions}
        placeholder="Search by order number..."
      />
      <DataTable
        columns={columns}
        data={orders}
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
