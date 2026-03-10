"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface FilterOption {
  label: string;
  value: string;
}

interface SearchFilterProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter?: string;
  onStatusChange?: (value: string) => void;
  statusOptions?: FilterOption[];
  placeholder?: string;
  debounceMs?: number;
}

export function SearchFilter({
  search,
  onSearchChange,
  statusFilter,
  onStatusChange,
  statusOptions,
  placeholder = "Search...",
  debounceMs = 400,
}: SearchFilterProps) {
  const [searchInput, setSearchInput] = useState(search);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    if (searchInput === search) return;
    const timer = setTimeout(() => {
      onSearchChange(searchInput);
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [searchInput, search, onSearchChange, debounceMs]);

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
        <Input
          placeholder={placeholder}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-8 pr-8"
        />
        {searchInput && (
          <button
            type="button"
            onClick={() => {
              setSearchInput("");
              onSearchChange("");
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {statusOptions && onStatusChange && (
        <Select value={statusFilter} onValueChange={onStatusChange}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {statusOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
