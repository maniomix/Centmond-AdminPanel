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
  minRefreshGapMs?: number;
}

function isEditingElement(element: Element | null): boolean {
  if (!element || !(element instanceof HTMLElement)) return false;
  if (element.isContentEditable) return true;
  const tag = element.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  const role = element.getAttribute("role");
  return role === "textbox";
}

export function LiveRefresh({
  tables,
  debounceMs = 750,
  intervalFallbackMs = 3000,
  minRefreshGapMs = 3000,
}: LiveRefreshProps) {
  const router = useRouter();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRefreshRef = useRef(false);
  const lastRefreshAtRef = useRef(0);

  useEffect(() => {
    if (!tables.length) return;

    const doRefresh = () => {
      lastRefreshAtRef.current = Date.now();
      pendingRefreshRef.current = false;
      router.refresh();
    };

    const scheduleRefresh = () => {
      if (document.visibilityState !== "visible") return;
      if (isEditingElement(document.activeElement)) {
        pendingRefreshRef.current = true;
        return;
      }

      const elapsed = Date.now() - lastRefreshAtRef.current;
      if (elapsed >= minRefreshGapMs) {
        if (refreshTimeoutRef.current) {
          clearTimeout(refreshTimeoutRef.current);
          refreshTimeoutRef.current = null;
        }
        doRefresh();
        return;
      }

      const waitMs = Math.max(0, minRefreshGapMs - elapsed);
      if (refreshTimeoutRef.current) return;
      refreshTimeoutRef.current = setTimeout(() => {
        refreshTimeoutRef.current = null;
        if (document.visibilityState !== "visible") return;
        if (isEditingElement(document.activeElement)) {
          pendingRefreshRef.current = true;
          return;
        }
        doRefresh();
      }, waitMs);
    };

    const flushPendingRefresh = () => {
      if (!pendingRefreshRef.current) return;
      if (document.visibilityState !== "visible") return;
      if (isEditingElement(document.activeElement)) return;
      scheduleRefresh();
    };

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
              scheduleRefresh();
            }, debounceMs);
          }
        )
        .subscribe()
    );

    const intervalId =
      intervalFallbackMs > 0
        ? setInterval(() => scheduleRefresh(), intervalFallbackMs)
        : null;

    const focusOutListener = () => {
      setTimeout(() => flushPendingRefresh(), 30);
    };

    document.addEventListener("focusout", focusOutListener);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      pendingRefreshRef.current = false;
      lastRefreshAtRef.current = 0;
      if (intervalId) {
        clearInterval(intervalId);
      }
      document.removeEventListener("focusout", focusOutListener);
      channels.forEach((channel) => {
        void supabase.removeChannel(channel);
      });
    };
  }, [router, tables, debounceMs, intervalFallbackMs, minRefreshGapMs]);

  return null;
}
