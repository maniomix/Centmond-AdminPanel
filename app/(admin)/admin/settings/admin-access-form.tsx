"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateAdminRoleAction, revokeAdminAction } from "./actions";

interface AdminUser {
  id: string;
  username: string;
  display_name: string | null;
  role: "super_admin" | "admin" | "viewer";
}

interface AdminAccessFormProps {
  admins: AdminUser[];
  currentAdminId: string;
}

const roleBadge: Record<string, "default" | "secondary" | "outline"> = {
  super_admin: "default",
  admin: "secondary",
  viewer: "outline",
};

export function AdminAccessForm({ admins, currentAdminId }: AdminAccessFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleRoleChange(id: string, role: "super_admin" | "admin" | "viewer") {
    setLoading(id);
    const result = await updateAdminRoleAction(id, role);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Role updated");
      router.refresh();
    }
    setLoading(null);
  }

  async function handleRevoke(id: string, username: string) {
    setLoading(id);
    const result = await revokeAdminAction(id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`Access revoked for @${username}`);
      router.refresh();
    }
    setLoading(null);
  }

  return (
    <div className="divide-y divide-neutral-100">
      {admins.map((admin) => {
        const isSelf = admin.id === currentAdminId;
        return (
          <div key={admin.id} className="flex items-center justify-between py-3.5">
            <div>
              <p className="text-sm font-medium text-neutral-900">
                {admin.display_name ?? `@${admin.username}`}
                {isSelf && (
                  <span className="ml-2 text-xs text-neutral-400">(you)</span>
                )}
              </p>
              <p className="text-xs text-neutral-500 font-mono">@{admin.username}</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={roleBadge[admin.role] ?? "secondary"} className="capitalize text-xs">
                {admin.role.replace("_", " ")}
              </Badge>
              {!isSelf && (
                <>
                  <Select
                    value={admin.role}
                    onValueChange={(v) => handleRoleChange(admin.id, v as "super_admin" | "admin" | "viewer")}
                    disabled={loading === admin.id}
                  >
                    <SelectTrigger className="h-8 w-28 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="super_admin">Super Admin</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                    disabled={loading === admin.id}
                    onClick={() => handleRevoke(admin.id, admin.username)}
                  >
                    Revoke
                  </Button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
