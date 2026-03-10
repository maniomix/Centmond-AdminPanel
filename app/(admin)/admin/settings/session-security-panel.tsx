"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/utils";
import {
  confirmSensitiveAccessAction,
  revokeManagedSessionAction,
} from "./actions";

interface AdminSessionListItem {
  id: string;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  idle_expires_at: string;
  device_label: string | null;
  ip_address: string | null;
  user_agent: string | null;
}

interface SessionSecurityPanelProps {
  activeSessions: AdminSessionListItem[];
  allowedIpCidrs: string[];
  currentSessionId: string;
  hasRecentSensitiveAuth: boolean;
  lastSensitiveAuthAt: string | null;
  sensitiveActionWindowMinutes: number;
}

export function SessionSecurityPanel({
  activeSessions,
  allowedIpCidrs,
  currentSessionId,
  hasRecentSensitiveAuth,
  lastSensitiveAuthAt,
  sensitiveActionWindowMinutes,
}: SessionSecurityPanelProps) {
  const [password, setPassword] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);

  async function handleConfirmSensitiveAccess() {
    setConfirming(true);
    const result = await confirmSensitiveAccessAction(password);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(
        `Sensitive actions unlocked for ${sensitiveActionWindowMinutes} minutes`
      );
      setPassword("");
    }
    setConfirming(false);
  }

  async function handleRevokeSession(sessionId: string) {
    setRevokingSessionId(sessionId);
    const result = await revokeManagedSessionAction(sessionId);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Session revoked");
    }
    setRevokingSessionId(null);
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-neutral-900">Sensitive Action Confirmation</p>
            <p className="mt-1 text-sm text-neutral-500">
              High-impact admin actions require a recent password confirmation.
            </p>
            <p className="mt-2 text-xs text-neutral-500">
              Last confirmed:{" "}
              {lastSensitiveAuthAt ? formatDate(lastSensitiveAuthAt) : "Not confirmed in this session"}
            </p>
          </div>
          <Badge variant={hasRecentSensitiveAuth ? "success" : "warning"}>
            {hasRecentSensitiveAuth ? "Available" : "Confirmation needed"}
          </Badge>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[260px] flex-1 space-y-1.5">
            <Label htmlFor="confirm-sensitive-password">Current password</Label>
            <Input
              id="confirm-sensitive-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <Button
            onClick={handleConfirmSensitiveAccess}
            disabled={confirming || !password.trim()}
          >
            {confirming ? "Confirming..." : "Confirm sensitive actions"}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <p className="text-sm font-medium text-neutral-900">IP Allowlist</p>
        {allowedIpCidrs.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {allowedIpCidrs.map((entry) => (
              <Badge key={entry} variant="secondary" className="font-mono">
                {entry}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-neutral-500">
            No IP restriction configured for this admin account.
          </p>
        )}
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white">
        <div className="border-b border-neutral-200 px-4 py-3">
          <p className="text-sm font-medium text-neutral-900">Active Sessions</p>
          <p className="mt-1 text-sm text-neutral-500">
            Review device metadata and revoke other sessions when needed.
          </p>
        </div>
        {!activeSessions.length ? (
          <div className="px-4 py-8 text-center text-sm text-neutral-400">
            No active sessions recorded.
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {activeSessions.map((session) => {
              const isCurrent = session.id === currentSessionId;
              return (
                <div
                  key={session.id}
                  className="flex flex-wrap items-start justify-between gap-4 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-neutral-900">
                        {session.device_label ?? "Unknown device"}
                      </p>
                      {isCurrent ? <Badge variant="success">Current</Badge> : null}
                    </div>
                    <p className="mt-1 text-xs text-neutral-500">
                      Last seen {formatDate(session.last_seen_at)} • Expires {formatDate(session.expires_at)}
                    </p>
                    <p className="mt-1 break-all text-xs text-neutral-400">
                      {session.ip_address ?? "No IP"} • {session.user_agent ?? "No user agent"}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isCurrent || revokingSessionId === session.id}
                    onClick={() => handleRevokeSession(session.id)}
                  >
                    {revokingSessionId === session.id ? "Revoking..." : "Revoke"}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
