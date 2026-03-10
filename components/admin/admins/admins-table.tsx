"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Plus, ShieldBan, ShieldCheck, ShieldEllipsis, UserCog } from "lucide-react";
import { toast } from "sonner";
import { DataTable } from "@/components/shared/data-table";
import { Pagination } from "@/components/shared/pagination";
import { SearchFilter } from "@/components/shared/search-filter";
import { ReasonDialog } from "@/components/admin/actions/reason-dialog";
import { AdminRoleBadge } from "@/components/admin/admins/admin-role-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getAssignableRoles, type AdminRole } from "@/lib/admin/constants";
import { formatDate } from "@/lib/utils";
import type { AdminUserRow } from "@/types";
import {
  createAdminAccountAction,
  revokeAdminSessionsAction,
  updateAdminStatusAction,
} from "@/app/(admin)/admin/admins/actions";

type StatusFilter = "all" | "active" | "suspended" | "deactivated";

interface AdminTableRow extends AdminUserRow {
  session_count: number;
}

interface AdminsTableProps {
  admins: AdminTableRow[];
  count: number;
  page: number;
  pageSize: number;
  search: string;
  status: StatusFilter;
}

const statusOptions = [
  { label: "Active", value: "active" },
  { label: "Suspended", value: "suspended" },
  { label: "Deactivated", value: "deactivated" },
];

const statusVariant: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
  active: "success",
  suspended: "warning",
  deactivated: "destructive",
};

interface CreateFormState {
  username: string;
  email: string;
  displayName: string;
  password: string;
  role: AdminRole;
}

export function AdminsTable({
  admins,
  count,
  page,
  pageSize,
  search,
  status,
}: AdminsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [createOpen, setCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createForm, setCreateForm] = useState<CreateFormState>({
    username: "",
    email: "",
    displayName: "",
    password: "",
    role: "analyst",
  });
  const [statusTarget, setStatusTarget] = useState<{
    adminId: string;
    username: string;
    nextStatus: "active" | "suspended" | "deactivated";
  } | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<{ adminId: string; username: string } | null>(
    null
  );

  const totalPages = Math.ceil(count / pageSize);

  function buildUrl(overrides: Record<string, string>) {
    const params = new URLSearchParams({
      page: String(page),
      search,
      status,
      ...overrides,
    });
    return `${pathname}?${params.toString()}`;
  }

  async function handleCreateAdmin() {
    setCreateLoading(true);
    const result = await createAdminAccountAction(createForm);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Admin account created");
      setCreateOpen(false);
      setCreateForm({
        username: "",
        email: "",
        displayName: "",
        password: "",
        role: "analyst",
      });
      router.refresh();
    }
    setCreateLoading(false);
  }

  const columns = [
    {
      key: "display_name",
      label: "Admin",
      render: (row: AdminTableRow) => (
        <div>
          <p className="font-medium text-neutral-900">{row.display_name ?? row.username}</p>
          <p className="text-xs text-neutral-500">{row.email ?? `@${row.username}`}</p>
        </div>
      ),
    },
    {
      key: "role",
      label: "Role",
      render: (row: AdminTableRow) => <AdminRoleBadge role={row.role} />,
    },
    {
      key: "status",
      label: "Status",
      render: (row: AdminTableRow) => (
        <Badge variant={statusVariant[row.status] ?? "secondary"} className="capitalize">
          {row.status}
        </Badge>
      ),
    },
    {
      key: "session_count",
      label: "Sessions",
      render: (row: AdminTableRow) => (
        <span className="text-sm text-neutral-700">{row.session_count}</span>
      ),
    },
    {
      key: "last_login_at",
      label: "Last Login",
      render: (row: AdminTableRow) => (
        <span className="text-sm text-neutral-500">
          {row.last_login_at ? formatDate(row.last_login_at) : "Never"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "",
      className: "w-[280px]",
      render: (row: AdminTableRow) => (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/admin/admins/${row.id}`}>
              <UserCog className="h-4 w-4" />
              Details
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setRevokeTarget({
                adminId: row.id,
                username: row.username,
              })
            }
          >
            <ShieldEllipsis className="h-4 w-4" />
            Revoke sessions
          </Button>
          {row.status === "active" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setStatusTarget({
                  adminId: row.id,
                  username: row.username,
                  nextStatus: "suspended",
                })
              }
            >
              <ShieldBan className="h-4 w-4" />
              Suspend
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setStatusTarget({
                  adminId: row.id,
                  username: row.username,
                  nextStatus: "active",
                })
              }
            >
              <ShieldCheck className="h-4 w-4" />
              Reactivate
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <SearchFilter
            search={search}
            onSearchChange={(value) => router.push(buildUrl({ search: value, page: "1" }))}
            statusFilter={status}
            onStatusChange={(value) => router.push(buildUrl({ status: value, page: "1" }))}
            statusOptions={statusOptions}
            placeholder="Search admins by username, email, or name..."
          />
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            New Admin
          </Button>
        </div>
        <DataTable columns={columns} data={admins} emptyMessage="No admins found." />
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={(nextPage) => router.push(buildUrl({ page: String(nextPage) }))}
          count={count}
          pageSize={pageSize}
        />
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Admin</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Username</Label>
                <Input
                  value={createForm.username}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, username: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  value={createForm.email}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, email: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Display Name</Label>
                <Input
                  value={createForm.displayName}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, displayName: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select
                  value={createForm.role}
                  onValueChange={(value) =>
                    setCreateForm((prev) => ({ ...prev, role: value as AdminRole }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getAssignableRoles().map((role) => (
                      <SelectItem key={role} value={role}>
                        {role.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Temporary Password</Label>
              <Input
                type="password"
                value={createForm.password}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, password: event.target.value }))
                }
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateAdmin} disabled={createLoading}>
                {createLoading ? "Creating..." : "Create admin"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ReasonDialog
        open={!!statusTarget}
        onOpenChange={(open) => !open && setStatusTarget(null)}
        title={
          statusTarget?.nextStatus === "active"
            ? "Reactivate admin"
            : "Suspend admin access"
        }
        description={
          statusTarget
            ? `This will change @${statusTarget.username} to ${statusTarget.nextStatus}.`
            : undefined
        }
        confirmLabel={statusTarget?.nextStatus === "active" ? "Reactivate" : "Suspend"}
        loadingLabel="Saving..."
        onConfirm={async (reason) => {
          if (!statusTarget) return;
          const result = await updateAdminStatusAction(
            statusTarget.adminId,
            statusTarget.nextStatus,
            reason
          );
          if (result.error) {
            toast.error(result.error);
          } else {
            toast.success("Admin status updated");
            setStatusTarget(null);
            router.refresh();
          }
        }}
      />

      <ReasonDialog
        open={!!revokeTarget}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
        title="Revoke all admin sessions"
        description={
          revokeTarget
            ? `All active sessions for @${revokeTarget.username} will be revoked.`
            : undefined
        }
        confirmLabel="Revoke sessions"
        loadingLabel="Revoking..."
        onConfirm={async (reason) => {
          if (!revokeTarget) return;
          const result = await revokeAdminSessionsAction(revokeTarget.adminId, reason);
          if (result.error) {
            toast.error(result.error);
          } else {
            toast.success("Admin sessions revoked");
            setRevokeTarget(null);
            router.refresh();
          }
        }}
      />
    </>
  );
}
