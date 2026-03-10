"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ReasonDialog } from "@/components/admin/actions/reason-dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getAssignableRoles, type AdminRole } from "@/lib/admin/constants";
import {
  assignAdminRoleAction,
  revokeAdminSessionsAction,
  updateAdminStatusAction,
} from "@/app/(admin)/admin/admins/actions";

interface AdminDetailActionsProps {
  adminId: string;
  username: string;
  currentRole: AdminRole;
  currentStatus: "active" | "suspended" | "deactivated";
}

export function AdminDetailActions({
  adminId,
  username,
  currentRole,
  currentStatus,
}: AdminDetailActionsProps) {
  const router = useRouter();
  const [pendingRole, setPendingRole] = useState<AdminRole>(currentRole);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);

  return (
    <>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <p className="text-xs uppercase tracking-wide text-neutral-500">Primary Role</p>
          <div className="flex gap-2">
            <Select value={pendingRole} onValueChange={(value) => setPendingRole(value as AdminRole)}>
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
            <Button
              variant="outline"
              disabled={pendingRole === currentRole}
              onClick={() => setRoleDialogOpen(true)}
            >
              Save role
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setStatusDialogOpen(true)}>
            {currentStatus === "active" ? "Suspend admin" : "Reactivate admin"}
          </Button>
          <Button variant="outline" onClick={() => setRevokeDialogOpen(true)}>
            Revoke all sessions
          </Button>
        </div>
      </div>

      <ReasonDialog
        open={roleDialogOpen}
        onOpenChange={setRoleDialogOpen}
        title="Change admin role"
        description={`Update @${username} from ${currentRole} to ${pendingRole}.`}
        confirmLabel="Update role"
        loadingLabel="Updating..."
        onConfirm={async (reason) => {
          const result = await assignAdminRoleAction(adminId, pendingRole, reason);
          if (result.error) {
            toast.error(result.error);
          } else {
            toast.success("Role updated");
            setRoleDialogOpen(false);
            router.refresh();
          }
        }}
      />

      <ReasonDialog
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
        title={currentStatus === "active" ? "Suspend admin" : "Reactivate admin"}
        description={`Change status for @${username}.`}
        confirmLabel={currentStatus === "active" ? "Suspend" : "Reactivate"}
        loadingLabel="Saving..."
        onConfirm={async (reason) => {
          const nextStatus = currentStatus === "active" ? "suspended" : "active";
          const result = await updateAdminStatusAction(adminId, nextStatus, reason);
          if (result.error) {
            toast.error(result.error);
          } else {
            toast.success("Status updated");
            setStatusDialogOpen(false);
            router.refresh();
          }
        }}
      />

      <ReasonDialog
        open={revokeDialogOpen}
        onOpenChange={setRevokeDialogOpen}
        title="Revoke admin sessions"
        description={`Revoke every active session for @${username}.`}
        confirmLabel="Revoke sessions"
        loadingLabel="Revoking..."
        onConfirm={async (reason) => {
          const result = await revokeAdminSessionsAction(adminId, reason);
          if (result.error) {
            toast.error(result.error);
          } else {
            toast.success("Sessions revoked");
            setRevokeDialogOpen(false);
            router.refresh();
          }
        }}
      />
    </>
  );
}
