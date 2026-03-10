"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function GlobalSearchForm({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");

  function submit(nextValue: string) {
    const query = nextValue.trim();
    if (!query) {
      router.push("/admin/search");
      return;
    }
    router.push(`/admin/search?q=${encodeURIComponent(query)}`);
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit(value);
      }}
      className={compact ? "w-full max-w-md" : "w-full"}
    >
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Search users, admins, subscriptions, transactions..."
          className="pl-9"
        />
      </div>
    </form>
  );
}
