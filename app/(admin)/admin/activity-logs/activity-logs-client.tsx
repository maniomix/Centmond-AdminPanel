"use client";

import { useRouter, usePathname } from "next/navigation";
import { SearchFilter } from "@/components/shared/search-filter";
import { Pagination } from "@/components/shared/pagination";

interface ActivityLogsClientProps {
  search: string;
  resource: string;
  page: number;
  totalPages: number;
  count: number;
  pageSize: number;
  children: React.ReactNode;
}

const resourceOptions = [
  { label: "Users", value: "users" },
  { label: "Orders", value: "orders" },
  { label: "Content", value: "content" },
  { label: "Settings", value: "settings" },
];

export function ActivityLogsClient({ search, resource, page, totalPages, count, pageSize, children }: ActivityLogsClientProps) {
  const router = useRouter();
  const pathname = usePathname();

  function buildUrl(overrides: Record<string, string>) {
    const params = new URLSearchParams({ page: String(page), search, status: resource, ...overrides });
    return `${pathname}?${params.toString()}`;
  }

  return (
    <div className="space-y-4">
      <SearchFilter
        search={search}
        onSearchChange={(v) => router.push(buildUrl({ search: v, page: "1" }))}
        statusFilter={resource}
        onStatusChange={(v) => router.push(buildUrl({ status: v, page: "1" }))}
        statusOptions={resourceOptions}
        placeholder="Search logs..."
      />
      {children}
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
