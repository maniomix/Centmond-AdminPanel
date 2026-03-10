"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { MoreHorizontal, Pencil, Plus, Search, X } from "lucide-react";
import { DataTable } from "@/components/shared/data-table";
import { Pagination } from "@/components/shared/pagination";
import { DeleteDialog } from "@/components/shared/delete-dialog";
import { LiveRefresh } from "@/components/shared/live-refresh";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateShort } from "@/lib/utils";
import { toast } from "sonner";
import type { TransactionRow } from "@/types";
import {
  createTransactionAction,
  deleteTransactionAction,
  updateTransactionAction,
} from "./actions";
import { formatEuroAmount, fromStoredMoney } from "@/lib/money";

const typeOptions: TransactionRow["type"][] = ["income", "expense"];

const typeVariant: Record<TransactionRow["type"], "success" | "warning"> = {
  income: "success",
  expense: "warning",
};

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY_FORM = {
  amount: "",
  type: "expense" as TransactionRow["type"],
  category: "",
  note: "",
  date: getTodayDate(),
};

interface TransactionsTableProps {
  transactions: TransactionRow[];
  count: number;
  userId: string;
  page: number;
  pageSize: number;
  search: string;
  type: string;
  category: string;
  categories: string[];
  sortBy: string;
  sortOrder: "asc" | "desc";
}

export function TransactionsTable({
  transactions,
  count,
  userId,
  page,
  pageSize,
  search,
  type,
  category,
  categories,
  sortBy,
  sortOrder,
}: TransactionsTableProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [editTarget, setEditTarget] = useState<TransactionRow | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [searchInput, setSearchInput] = useState(search);

  const totalPages = Math.ceil(count / pageSize);
  const liveTables = useMemo(
    () => [{ table: "transactions", filter: `user_id=eq.${userId}` }],
    [userId]
  );

  function buildUrl(overrides: Record<string, string>) {
    const params = new URLSearchParams({
      page: String(page),
      search: searchInput,
      type,
      category,
      sortBy,
      sortOrder,
      ...overrides,
    });
    return `${pathname}?${params.toString()}`;
  }

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    if (searchInput === search) return;
    const timer = setTimeout(() => {
      const params = new URLSearchParams({
        page: "1",
        search: searchInput,
        type,
        category,
        sortBy,
        sortOrder,
      });
      router.replace(`${pathname}?${params.toString()}`);
    }, 400);
    return () => clearTimeout(timer);
  }, [category, pathname, router, search, searchInput, sortBy, sortOrder, type]);

  function handleSort(key: string) {
    const newOrder = sortBy === key && sortOrder === "asc" ? "desc" : "asc";
    router.push(buildUrl({ sortBy: key, sortOrder: newOrder, page: "1" }));
  }

  async function handleDelete(id: string) {
    const result = await deleteTransactionAction(id, userId);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Transaction removed");
      router.refresh();
    }
  }

  async function handleSaveEdit() {
    if (!editTarget) return;
    if (!form.amount || !form.category.trim() || !form.date) return;

    setSaving(true);
    const result = await updateTransactionAction(editTarget.id, userId, {
      amount: Number(form.amount),
      type: form.type,
      category: form.category.trim(),
      note: form.note.trim() || null,
      date: form.date,
    });

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Transaction updated");
      setEditTarget(null);
      router.refresh();
    }
    setSaving(false);
  }

  async function handleAdd() {
    if (!form.amount || !form.category.trim() || !form.date) return;

    setSaving(true);
    const result = await createTransactionAction(userId, {
      amount: Number(form.amount),
      type: form.type,
      category: form.category.trim(),
      note: form.note.trim() || null,
      date: form.date,
    });

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Transaction added");
      setAddOpen(false);
      setForm(EMPTY_FORM);
      router.refresh();
    }
    setSaving(false);
  }

  function openEdit(tx: TransactionRow) {
    setForm({
      amount: fromStoredMoney(tx.amount).toFixed(2),
      type: tx.type,
      category: tx.category,
      note: tx.note ?? "",
      date: tx.date,
    });
    setEditTarget(tx);
  }

  const columns = [
    {
      key: "date",
      label: "Date",
      sortable: true,
      render: (row: TransactionRow) => (
        <span className="font-medium text-neutral-800">{row.date}</span>
      ),
    },
    {
      key: "type",
      label: "Type",
      sortable: true,
      render: (row: TransactionRow) => (
        <Badge variant={typeVariant[row.type]} className="capitalize text-xs">
          {row.type}
        </Badge>
      ),
    },
    {
      key: "category",
      label: "Category",
      sortable: true,
      render: (row: TransactionRow) => (
        <span className="text-sm text-neutral-700">{row.category}</span>
      ),
    },
    {
      key: "amount",
      label: "Amount",
      sortable: true,
      render: (row: TransactionRow) => (
        <span
          className={`font-semibold text-sm ${
            row.type === "income" ? "text-green-600" : "text-red-600"
          }`}
        >
          {row.type === "income" ? "+" : "-"}
          {formatEuroAmount(row.amount)} €
        </span>
      ),
    },
    {
      key: "note",
      label: "Note",
      render: (row: TransactionRow) => (
        <span className="text-xs text-neutral-500 max-w-[260px] truncate block">
          {row.note ?? "-"}
        </span>
      ),
    },
    {
      key: "updated_at",
      label: "Updated",
      sortable: true,
      render: (row: TransactionRow) => (
        <span className="text-xs text-neutral-500">
          {formatDateShort(row.updated_at)}
        </span>
      ),
    },
    {
      key: "actions",
      label: "",
      className: "w-12",
      render: (row: TransactionRow) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="cursor-pointer"
              onSelect={() => openEdit(row)}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-red-600 focus:text-red-600 cursor-pointer"
              onSelect={(e) => e.preventDefault()}
            >
              <DeleteDialog
                onConfirm={() => handleDelete(row.id)}
                title="Delete transaction"
                description="This will archive the transaction from this user's ledger."
                trigger={<span className="flex items-center gap-2 w-full">Delete</span>}
              />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <>
      <LiveRefresh tables={liveTables} intervalFallbackMs={3000} />
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-1 items-center gap-2">
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <Input
                placeholder="Search by category or note..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-8 pr-8"
              />
              {searchInput && (
                <button
                  onClick={() => {
                    setSearchInput("");
                    router.replace(buildUrl({ search: "", page: "1" }));
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Select
              value={type}
              onValueChange={(v) => router.push(buildUrl({ type: v, page: "1" }))}
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {typeOptions.map((item) => (
                  <SelectItem key={item} value={item} className="capitalize">
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={category}
              onValueChange={(v) => router.push(buildUrl({ category: v, page: "1" }))}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setForm(EMPTY_FORM);
              setAddOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add transaction
          </Button>
        </div>

        <DataTable
          columns={columns}
          data={transactions}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={handleSort}
          emptyMessage="No transactions found for this user."
        />
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={(p) => router.push(buildUrl({ page: String(p) }))}
          count={count}
          pageSize={pageSize}
        />
      </div>

      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
          </DialogHeader>
          <TransactionForm
            form={form}
            onChange={setForm}
            onSubmit={handleSaveEdit}
            saving={saving}
            submitLabel="Save changes"
          />
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Transaction</DialogTitle>
          </DialogHeader>
          <TransactionForm
            form={form}
            onChange={setForm}
            onSubmit={handleAdd}
            saving={saving}
            submitLabel="Add transaction"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

interface FormState {
  amount: string;
  type: TransactionRow["type"];
  category: string;
  note: string;
  date: string;
}

function TransactionForm({
  form,
  onChange,
  onSubmit,
  saving,
  submitLabel,
}: {
  form: FormState;
  onChange: (f: FormState) => void;
  onSubmit: () => void;
  saving: boolean;
  submitLabel: string;
}) {
  return (
    <div className="space-y-4 pt-2">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Date</Label>
          <Input
            type="date"
            value={form.date}
            onChange={(e) => onChange({ ...form, date: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Amount</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={form.amount}
            onChange={(e) => onChange({ ...form, amount: e.target.value })}
            placeholder="0.00"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Type</Label>
          <Select
            value={form.type}
            onValueChange={(v) => onChange({ ...form, type: v as TransactionRow["type"] })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {typeOptions.map((item) => (
                <SelectItem key={item} value={item} className="capitalize">
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Input
            value={form.category}
            onChange={(e) => onChange({ ...form, category: e.target.value })}
            placeholder="e.g. groceries"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Note</Label>
        <Textarea
          value={form.note}
          onChange={(e) => onChange({ ...form, note: e.target.value })}
          placeholder="Optional note..."
          rows={2}
        />
      </div>
      <div className="flex justify-end">
        <Button
          onClick={onSubmit}
          disabled={saving || !form.amount || Number(form.amount) <= 0 || !form.category.trim() || !form.date}
          size="sm"
        >
          {saving ? "Saving..." : submitLabel}
        </Button>
      </div>
    </div>
  );
}
