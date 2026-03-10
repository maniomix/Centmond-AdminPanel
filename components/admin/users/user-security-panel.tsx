"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ReasonDialog } from "@/components/admin/actions/reason-dialog";
import { formatDate } from "@/lib/utils";
import {
  markUserDeviceSuspiciousAction,
  revokeAllUserSessionsAction,
  revokeUserSessionAction,
} from "@/app/(admin)/admin/users/[id]/security-actions";

interface UserSessionView {
  id: string;
  session_label: string | null;
  device_id: string | null;
  ip_address: string | null;
  country_code: string | null;
  region: string | null;
  user_agent: string | null;
  status: string;
  started_at: string;
  last_seen_at: string;
  require_reauth: boolean;
}

interface UserSecurityPanelProps {
  userId: string;
  sessions: UserSessionView[];
  devices: Array<{
    id: string;
    device_label: string | null;
    platform: string | null;
    os: string | null;
    browser: string | null;
    model: string | null;
    last_ip_address: string | null;
    last_country_code: string | null;
    last_region: string | null;
    last_seen_at: string;
    is_suspicious: boolean;
  }>;
  canManageSessions?: boolean;
}

export function UserSecurityPanel({
  userId,
  sessions,
  devices,
  canManageSessions = false,
}: UserSecurityPanelProps) {
  const router = useRouter();
  const [revokeSessionId, setRevokeSessionId] = useState<string | null>(null);
  const [markDeviceId, setMarkDeviceId] = useState<{ id: string; next: boolean } | null>(null);
  const [revokeAllOpen, setRevokeAllOpen] = useState(false);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Sessions & Devices</CardTitle>
        <CardDescription>
          Real user session and device records from the security data model.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {canManageSessions ? (
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setRevokeAllOpen(true)}>
              Revoke all sessions
            </Button>
          </div>
        ) : null}

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Sessions
          </p>
          {!sessions.length ? (
            <div className="rounded-lg border border-dashed border-neutral-200 px-4 py-5 text-sm text-neutral-400">
              No real user sessions have been recorded yet.
            </div>
          ) : (
            sessions.map((session) => (
              <div key={session.id} className="rounded-lg border border-neutral-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-neutral-900">
                      {session.session_label ?? "Unnamed session"}
                    </p>
                    <Badge variant={session.status === "active" ? "success" : "secondary"}>
                      {session.status}
                    </Badge>
                    {session.require_reauth ? <Badge variant="warning">reauth required</Badge> : null}
                  </div>
                  <p className="text-xs text-neutral-500">{formatDate(session.last_seen_at)}</p>
                </div>
                <p className="mt-1 text-xs text-neutral-500">
                  Started {formatDate(session.started_at)}
                  {session.ip_address ? ` • ${session.ip_address}` : ""}
                  {session.country_code || session.region
                    ? ` • ${[session.country_code, session.region].filter(Boolean).join(" / ")}`
                    : ""}
                </p>
                {session.user_agent ? (
                  <p className="mt-2 text-xs text-neutral-500">{session.user_agent}</p>
                ) : null}
                {canManageSessions && session.status === "active" ? (
                  <div className="mt-3 flex justify-end">
                    <Button variant="outline" size="sm" onClick={() => setRevokeSessionId(session.id)}>
                      Revoke
                    </Button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Devices
          </p>
          {!devices.length ? (
            <div className="rounded-lg border border-dashed border-neutral-200 px-4 py-5 text-sm text-neutral-400">
              No device inventory has been recorded yet.
            </div>
          ) : (
            devices.map((device) => (
              <div key={device.id} className="rounded-lg border border-neutral-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-neutral-900">
                      {(device.device_label ??
                        [device.platform, device.os, device.browser, device.model]
                          .filter(Boolean)
                          .join(" / ")) || "Unknown device"}
                    </p>
                    {device.is_suspicious ? <Badge variant="warning">suspicious</Badge> : null}
                  </div>
                  <p className="text-xs text-neutral-500">{formatDate(device.last_seen_at)}</p>
                </div>
                <p className="mt-1 text-xs text-neutral-500">
                  {[device.last_ip_address, device.last_country_code, device.last_region]
                    .filter(Boolean)
                    .join(" • ") || "No network metadata"}
                </p>
                {canManageSessions ? (
                  <div className="mt-3 flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setMarkDeviceId({ id: device.id, next: !device.is_suspicious })
                      }
                    >
                      {device.is_suspicious ? "Clear suspicious" : "Mark suspicious"}
                    </Button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </CardContent>

      <ReasonDialog
        open={Boolean(revokeSessionId)}
        onOpenChange={(open) => {
          if (!open) setRevokeSessionId(null);
        }}
        title="Revoke session"
        description="This will force the user to authenticate again on the selected session."
        confirmLabel="Revoke session"
        loadingLabel="Revoking..."
        onConfirm={async (reason) => {
          if (!revokeSessionId) return;
          const result = await revokeUserSessionAction({ userId, sessionId: revokeSessionId, reason });
          const errorMessage = "error" in result ? result.error : undefined;
          if (typeof errorMessage === "string" && errorMessage) {
            toast.error(errorMessage);
            return;
          }
          toast.success("Session revoked");
          setRevokeSessionId(null);
          router.refresh();
        }}
      />

      <ReasonDialog
        open={revokeAllOpen}
        onOpenChange={setRevokeAllOpen}
        title="Revoke all sessions"
        description="This will revoke all active user sessions and require fresh authentication."
        confirmLabel="Revoke all"
        loadingLabel="Revoking..."
        onConfirm={async (reason) => {
          const result = await revokeAllUserSessionsAction({ userId, reason });
          const errorMessage = "error" in result ? result.error : undefined;
          if (typeof errorMessage === "string" && errorMessage) {
            toast.error(errorMessage);
            return;
          }
          toast.success("All sessions revoked");
          setRevokeAllOpen(false);
          router.refresh();
        }}
      />

      <ReasonDialog
        open={Boolean(markDeviceId)}
        onOpenChange={(open) => {
          if (!open) setMarkDeviceId(null);
        }}
        title={markDeviceId?.next ? "Mark device suspicious" : "Clear suspicious device"}
        description="This updates the device inventory and security review signal for the account."
        confirmLabel={markDeviceId?.next ? "Mark suspicious" : "Clear marker"}
        loadingLabel="Saving..."
        onConfirm={async (reason) => {
          if (!markDeviceId) return;
          const result = await markUserDeviceSuspiciousAction(
            { userId, deviceId: markDeviceId.id, reason },
            markDeviceId.next
          );
          const errorMessage = "error" in result ? result.error : undefined;
          if (typeof errorMessage === "string" && errorMessage) {
            toast.error(errorMessage);
            return;
          }
          toast.success(markDeviceId.next ? "Device marked suspicious" : "Suspicious marker cleared");
          setMarkDeviceId(null);
          router.refresh();
        }}
      />
    </Card>
  );
}
