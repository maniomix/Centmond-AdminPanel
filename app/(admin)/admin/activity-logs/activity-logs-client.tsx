"use client";

import { useRouter, usePathname } from "next/navigation";
import { SearchFilter } from "@/components/shared/search-filter";
import { Pagination } from "@/components/shared/pagination";
import { LiveRefresh } from "@/components/shared/live-refresh";

interface ActivityLogsClientProps {
  search: string;
  eventName: string;
  eventOptions: string[];
  page: number;
  totalPages: number;
  count: number;
  pageSize: number;
  children: React.ReactNode;
}

export function ActivityLogsClient({
  search,
  eventName,
  eventOptions,
  page,
  totalPages,
  count,
  pageSize,
  children,
}: ActivityLogsClientProps) {
  const router = useRouter();
  const pathname = usePathname();

  function buildUrl(overrides: Record<string, string>) {
    const params = new URLSearchParams({
      page: String(page),
      search,
      status: eventName,
      ...overrides,
    });
    return `${pathname}?${params.toString()}`;
  }

  return (
    <div className="space-y-4">
      <LiveRefresh tables={[{ table: "events" }]} intervalFallbackMs={30000} />
      <SearchFilter
        search={search}
        onSearchChange={(v) => router.push(buildUrl({ search: v, page: "1" }))}
        statusFilter={eventName}
        onStatusChange={(v) => router.push(buildUrl({ status: v, page: "1" }))}
        statusOptions={eventOptions.map((value) => ({ label: value, value }))}
        placeholder="Search by event name..."
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
