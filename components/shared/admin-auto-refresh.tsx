"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface AdminAutoRefreshProps {
  intervalMs?: number;
}

function isEditingElement(element: Element | null): boolean {
  if (!element || !(element instanceof HTMLElement)) return false;
  if (element.isContentEditable) return true;
  const tag = element.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  const role = element.getAttribute("role");
  return role === "textbox";
}

export function AdminAutoRefresh({ intervalMs = 3000 }: AdminAutoRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    let pendingRefresh = false;

    const triggerRefresh = () => {
      if (document.visibilityState !== "visible") return;
      if (isEditingElement(document.activeElement)) {
        pendingRefresh = true;
        return;
      }
      pendingRefresh = false;
      router.refresh();
    };

    const flushPendingRefresh = () => {
      if (!pendingRefresh) return;
      if (document.visibilityState !== "visible") return;
      if (isEditingElement(document.activeElement)) return;
      pendingRefresh = false;
      router.refresh();
    };

    const id = setInterval(() => {
      triggerRefresh();
    }, intervalMs);

    const focusOutListener = () => {
      setTimeout(() => flushPendingRefresh(), 30);
    };

    document.addEventListener("focusout", focusOutListener);

    return () => {
      pendingRefresh = false;
      clearInterval(id);
      document.removeEventListener("focusout", focusOutListener);
    };
  }, [router, intervalMs]);

  return null;
}
