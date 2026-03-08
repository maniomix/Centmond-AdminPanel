"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface LiveRefreshTable {
  table: string;
  filter?: string;
  event?: "*" | "INSERT" | "UPDATE" | "DELETE";
}

interface LiveRefreshProps {
  tables: LiveRefreshTable[];
  debounceMs?: number;
  intervalFallbackMs?: number;
}

export function LiveRefresh({
  tables,
  debounceMs = 750,
  intervalFallbackMs = 0,
}: LiveRefreshProps) {
  const router = useRouter();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!tables.length) return;

    const supabase = createClient();
    const channels = tables.map((tableCfg, index) =>
      supabase
        .channel(`admin-live-${tableCfg.table}-${index}`)
        .on(
          "postgres_changes",
          {
            event: tableCfg.event ?? "*",
            schema: "public",
            table: tableCfg.table,
            filter: tableCfg.filter,
          },
          () => {
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
            }
            timeoutRef.current = setTimeout(() => {
              router.refresh();
            }, debounceMs);
          }
        )
        .subscribe()
    );

    const intervalId =
      intervalFallbackMs > 0
        ? setInterval(() => router.refresh(), intervalFallbackMs)
        : null;

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (intervalId) {
        clearInterval(intervalId);
      }
      channels.forEach((channel) => {
        void supabase.removeChannel(channel);
      });
    };
  }, [router, tables, debounceMs, intervalFallbackMs]);

  return null;
}
