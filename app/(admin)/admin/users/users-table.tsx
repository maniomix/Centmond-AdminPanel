"use client";

import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Eye, MoreHorizontal } from "lucide-react";
import { DataTable } from "@/components/shared/data-table";
import { Pagination } from "@/components/shared/pagination";
import { SearchFilter } from "@/components/shared/search-filter";
import { DeleteDialog } from "@/components/shared/delete-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { formatDateShort } from "@/lib/utils";
import { toast } from "sonner";
import type { UserRow } from "@/types";
import { useCallback } from "react";

const statusOptions = [
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
  { label: "Suspended", value: "suspended" },
];

const statusBadgeVariant: Record<string, "success" | "secondary" | "destructive"> = {
  active: "success",
  inactive: "secondary",
  suspended: "destructive",
};

interface UsersTableProps {
  users: UserRow[];
  count: number;
  page: number;
  pageSize: number;
  search: string;
  status: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
}

export function UsersTable({ users, count, page, pageSize, search, status, sortBy, sortOrder }: UsersTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const totalPages = Math.ceil(count / pageSize);

  function buildUrl(overrides: Record<string, string>) {
    const params = new URLSearchParams({
      page: String(page),
      search,
      status,
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

  function handleSearch(value: string) {
    router.push(buildUrl({ search: value, page: "1" }));
  }

  function handleStatus(value: string) {
    router.push(buildUrl({ status: value, page: "1" }));
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from("users").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete user");
      return;
    }
    toast.success("User deleted");
    router.refresh();
  }

  const columns = [
    {
      key: "full_name",
      label: "Name",
      sortable: true,
      render: (row: UserRow) => (
        <div>
          <p className="font-medium text-neutral-900">{row.full_name ?? "—"}</p>
          <p className="text-xs text-neutral-500">{row.email}</p>
        </div>
      ),
    },
    {
      key: "role",
      label: "Role",
      render: (row: UserRow) => (
        <Badge variant="outline" className="capitalize text-xs">{row.role}</Badge>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row: UserRow) => (
        <Badge variant={statusBadgeVariant[row.status]} className="capitalize text-xs">
          {row.status}
        </Badge>
      ),
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
      key: "last_login",
      label: "Last Login",
      render: (row: UserRow) => (
        <span className="text-neutral-500">
          {row.last_login ? formatDateShort(row.last_login) : "Never"}
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
            <DropdownMenuItem
              className="text-red-600 focus:text-red-600 cursor-pointer"
              onSelect={(e) => e.preventDefault()}
            >
              <DeleteDialog
                onConfirm={() => handleDelete(row.id)}
                title="Delete user"
                description={`Are you sure you want to delete "${row.full_name ?? row.email}"? This action cannot be undone.`}
                trigger={<span className="flex items-center gap-2 w-full">Delete user</span>}
              />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <SearchFilter
        search={search}
        onSearchChange={handleSearch}
        statusFilter={status}
        onStatusChange={handleStatus}
        statusOptions={statusOptions}
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
