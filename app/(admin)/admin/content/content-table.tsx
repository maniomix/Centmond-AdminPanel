"use client";

import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Pencil, MoreHorizontal } from "lucide-react";
import { DataTable } from "@/components/shared/data-table";
import { Pagination } from "@/components/shared/pagination";
import { SearchFilter } from "@/components/shared/search-filter";
import { DeleteDialog } from "@/components/shared/delete-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDateShort } from "@/lib/utils";
import { toast } from "sonner";
import type { ContentRow } from "@/types";
import { deleteContentAction } from "./actions";

const statusOptions = [
  { label: "Draft", value: "draft" },
  { label: "Published", value: "published" },
  { label: "Archived", value: "archived" },
];

const statusVariant: Record<string, "secondary" | "success" | "outline"> = {
  draft: "secondary",
  published: "success",
  archived: "outline",
};

interface ContentTableProps {
  content: ContentRow[];
  count: number;
  page: number;
  pageSize: number;
  search: string;
  status: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
}

export function ContentTable({ content, count, page, pageSize, search, status, sortBy, sortOrder }: ContentTableProps) {
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

  async function handleDelete(id: string) {
    const result = await deleteContentAction(id);
    if (result.error) {
      toast.error("Failed to delete content");
      return;
    }
    toast.success("Content deleted");
    router.refresh();
  }

  const columns = [
    {
      key: "title",
      label: "Title",
      sortable: true,
      render: (row: ContentRow) => (
        <div>
          <p className="font-medium text-neutral-900">{row.title}</p>
          <p className="text-xs text-neutral-400 font-mono">/{row.slug}</p>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row: ContentRow) => (
        <Badge variant={statusVariant[row.status] ?? "secondary"} className="capitalize text-xs">
          {row.status}
        </Badge>
      ),
    },
    {
      key: "category",
      label: "Category",
      render: (row: ContentRow) => (
        <span className="text-sm text-neutral-500">{row.category ?? "—"}</span>
      ),
    },
    {
      key: "published_at",
      label: "Published",
      sortable: true,
      render: (row: ContentRow) => (
        <span className="text-neutral-500">
          {row.published_at ? formatDateShort(row.published_at) : "—"}
        </span>
      ),
    },
    {
      key: "created_at",
      label: "Created",
      sortable: true,
      render: (row: ContentRow) => (
        <span className="text-neutral-500">{formatDateShort(row.created_at)}</span>
      ),
    },
    {
      key: "actions",
      label: "",
      className: "w-12",
      render: (row: ContentRow) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/admin/content/${row.id}`} className="cursor-pointer">
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600 focus:text-red-600 cursor-pointer" onSelect={(e) => e.preventDefault()}>
              <DeleteDialog
                onConfirm={() => handleDelete(row.id)}
                title="Delete content"
                description={`Delete "${row.title}"? This cannot be undone.`}
                trigger={<span className="flex items-center gap-2 w-full">Delete</span>}
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
        onSearchChange={(v) => router.push(buildUrl({ search: v, page: "1" }))}
        statusFilter={status}
        onStatusChange={(v) => router.push(buildUrl({ status: v, page: "1" }))}
        statusOptions={statusOptions}
        placeholder="Search by title or slug..."
      />
      <DataTable
        columns={columns}
        data={content}
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
