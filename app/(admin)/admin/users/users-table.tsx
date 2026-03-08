"use client";

import { useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Eye, MoreHorizontal, ReceiptText, ShieldCheck } from "lucide-react";
import { DataTable } from "@/components/shared/data-table";
import { Pagination } from "@/components/shared/pagination";
import { SearchFilter } from "@/components/shared/search-filter";
import { LiveRefresh } from "@/components/shared/live-refresh";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDateShort } from "@/lib/utils";
import type { UserRow } from "@/types";

const verificationOptions = [
  { label: "Verified", value: "verified" },
  { label: "Unverified", value: "unverified" },
];

const planVariant: Record<string, "default" | "secondary" | "success"> = {
  free: "secondary",
  monthly: "default",
  yearly: "success",
};

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
      plan: string;
      status: string;
      updated_at: string;
    }
  >;
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
}: UsersTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const totalPages = Math.ceil(count / pageSize);

  const liveTables = useMemo(
    () => [{ table: "users" }, { table: "subscriptions" }],
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

  const columns = [
    {
      key: "display_name",
      label: "User",
      sortable: true,
      render: (row: UserRow) => (
        <div>
          <p className="font-medium text-neutral-900">
            {(row.display_name ?? "Unnamed").trim()}
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
      key: "subscription",
      label: "Subscription",
      render: (row: UserRow) => {
        const subscription = subscriptionByUserId[row.id];
        if (!subscription) {
          return <span className="text-xs text-neutral-400">No subscription</span>;
        }

        return (
          <div className="flex items-center gap-2">
            <Badge variant={planVariant[subscription.plan] ?? "secondary"} className="capitalize text-xs">
              {subscription.plan}
            </Badge>
            <span className="text-xs text-neutral-500 capitalize">{subscription.status}</span>
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
      label: "Last Active",
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/admin/users/${row.id}`} className="cursor-pointer">
                <Eye className="mr-2 h-4 w-4" />
                View details
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/admin/users/${row.id}/transactions`} className="cursor-pointer">
                <ReceiptText className="mr-2 h-4 w-4" />
                Transactions
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/admin/subscriptions?userId=${row.id}`} className="cursor-pointer">
                <ShieldCheck className="mr-2 h-4 w-4" />
                Subscription
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <LiveRefresh tables={liveTables} intervalFallbackMs={30000} />
      <SearchFilter
        search={search}
        onSearchChange={(value) => router.push(buildUrl({ search: value, page: "1" }))}
        statusFilter={verification}
        onStatusChange={(value) => router.push(buildUrl({ verification: value, page: "1" }))}
        statusOptions={verificationOptions}
        placeholder="Search by name or email..."
      />
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
