import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { UserEditForm } from "./user-edit-form";
import { formatEuroAmount } from "@/lib/money";
import { pickLatestIsoTimestamp } from "@/lib/user-activity";
import {
  getSubscriptionBadgeVariant,
  hasElevatedAccess,
  summarizeJson,
} from "@/lib/user-admin";
import { UserControlCenter } from "./user-control-center";
import { UserNotesPanel } from "@/components/admin/notes/user-notes-panel";
import { UserTagsPanel } from "@/components/admin/notes/user-tags-panel";
import { UserFlagsPanel } from "@/components/admin/notes/user-flags-panel";
import { hasPermission, requirePermission } from "@/lib/admin/permissions";
import { UserTimelinePanel } from "@/components/admin/users/user-timeline-panel";
import { UserSecurityPanel } from "@/components/admin/users/user-security-panel";
import { SupportHandoffsPanel } from "@/components/admin/users/support-handoffs-panel";
import { listSupportHandoffsForUser } from "@/lib/admin/services/reviews";
import { listUserSecurityData } from "@/lib/admin/services/user-security";

const planVariant: Record<string, "default" | "secondary" | "success"> = {
  free: "secondary",
  monthly: "default",
  yearly: "success",
};

const ACTIVITY_WINDOW_DAYS = 7;
const TRANSACTION_WINDOW_DAYS = 30;

function buildLookbackIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function buildLookbackDate(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function deviceSummary(
  deviceInfo: unknown,
  eventProperties: unknown
): string | null {
  const fromRecord = (value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    const parts = [record.platform, record.os, record.browser, record.device]
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter(Boolean);
    return parts.length ? parts.join(" / ") : null;
  };

  return fromRecord(deviceInfo) ?? fromRecord(eventProperties);
}

function humanizeValue(value: string | null | undefined): string {
  const normalized = value?.trim();
  if (!normalized) return "Unknown";

  return normalized
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const adminContext = await requirePermission("users.view");
  const canViewUserSessions = hasPermission(adminContext, "user_sessions.view");
  const canManageUserSessions = hasPermission(adminContext, "user_sessions.manage");
  const canViewSupportHandoffs =
    hasPermission(adminContext, "support_handoffs.manage") ||
    hasPermission(adminContext, "support.view");
  const canManageSupportHandoffs = hasPermission(adminContext, "support_handoffs.manage");
  const canViewAuditHistory = hasPermission(adminContext, "audit_logs.view");
  const { id } = await params;
  const supabase = createAdminClient();
  const activitySinceIso = buildLookbackIso(ACTIVITY_WINDOW_DAYS);
  const transactionSinceDate = buildLookbackDate(TRANSACTION_WINDOW_DAYS);

  const { data: user } = await supabase.from("users").select("*").eq("id", id).single();
  if (!user) notFound();

  const [
    { data: subscription },
    { data: recentTransactions },
    { data: recentEvents },
    { data: activityRows },
    { data: transactionRows30d },
    { data: notes },
    { data: allTags },
    { data: tagAssignments },
    { data: allFlags },
    { data: flagAssignments },
    { data: adminAuditLogs },
    securityData,
    supportHandoffs,
    { data: adminDirectory },
  ] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("transactions")
      .select("id, amount, type, category, note, date, created_at")
      .eq("user_id", id)
      .eq("is_deleted", false)
      .order("date", { ascending: false })
      .limit(6),
    supabase
      .from("events")
      .select("id, event_name, event_properties, device_info, session_id, created_at")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("events")
      .select("event_name")
      .eq("user_id", id)
      .gte("created_at", activitySinceIso)
      .order("created_at", { ascending: false })
      .limit(2000),
    supabase
      .from("transactions")
      .select("amount, type, category, date")
      .eq("user_id", id)
      .eq("is_deleted", false)
      .gte("date", transactionSinceDate)
      .order("date", { ascending: false })
      .limit(2000),
    supabase
      .from("user_notes")
      .select("id, user_id, author_admin_id, note_type, body, is_pinned, is_internal_only, created_at, updated_at, deleted_at")
      .eq("user_id", id)
      .is("deleted_at", null)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("user_tags").select("id, key, label, color, description, is_system, created_at").order("label"),
    supabase.from("user_tag_assignments").select("user_id, tag_id, assigned_by_admin_id, created_at").eq("user_id", id),
    supabase.from("user_flags").select("id, key, label, description, severity, is_system, created_at").order("label"),
    supabase
      .from("user_flag_assignments")
      .select("id, user_id, flag_id, status, reason, assigned_by_admin_id, resolved_by_admin_id, resolved_at, created_at, updated_at")
      .eq("user_id", id)
      .eq("status", "active")
      .order("created_at", { ascending: false }),
    canViewAuditHistory
      ? supabase
          .from("admin_audit_logs")
          .select("id, action_type, category, severity, reason, actor_admin_id, created_at")
          .eq("target_entity_type", "user")
          .eq("target_entity_id", id)
          .order("created_at", { ascending: false })
          .limit(12)
      : Promise.resolve({ data: [] }),
    canViewUserSessions
      ? listUserSecurityData(id)
      : Promise.resolve({ sessions: [], devices: [] }),
    canViewSupportHandoffs
      ? listSupportHandoffsForUser(id)
      : Promise.resolve([]),
    supabase
      .from("admin_users")
      .select("id, username, display_name")
      .order("username"),
  ]);

  const effectiveLastActiveAt = pickLatestIsoTimestamp(
    user.last_active_at,
    recentEvents?.[0]?.created_at ?? null
  );
  const displayName = user.display_name?.trim() || "Unnamed User";
  const eventsLast7d = activityRows?.length ?? 0;
  const transactionsLast30d = transactionRows30d?.length ?? 0;
  const income30d = (transactionRows30d ?? [])
    .filter((tx) => tx.type === "income")
    .reduce((sum, tx) => sum + Number(tx.amount ?? 0), 0);
  const expense30d = (transactionRows30d ?? [])
    .filter((tx) => tx.type === "expense")
    .reduce((sum, tx) => sum + Number(tx.amount ?? 0), 0);
  const net30d = income30d - expense30d;
  const adminLabelById = new Map(
    (adminDirectory ?? []).map((admin) => [admin.id, admin.display_name ?? admin.username])
  );
  const tagsById = new Map((allTags ?? []).map((tag) => [tag.id, tag]));
  const assignedTags = (tagAssignments ?? [])
    .map((assignment) => tagsById.get(assignment.tag_id))
    .filter((tag): tag is NonNullable<typeof tag> => Boolean(tag));
  const flagsById = new Map((allFlags ?? []).map((flag) => [flag.id, flag]));
  const activeFlags = (flagAssignments ?? [])
    .map((assignment) => {
      const flag = flagsById.get(assignment.flag_id);
      if (!flag) return null;
      return {
        ...assignment,
        flag,
      };
    })
    .filter(
      (
        assignment
      ): assignment is NonNullable<typeof assignment> => Boolean(assignment)
    );
  const topEventsLast7d = Array.from(
    (activityRows ?? []).reduce((map, row) => {
      map.set(row.event_name, (map.get(row.event_name) ?? 0) + 1);
      return map;
    }, new Map<string, number>())
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const timelineItems = [
    ...(recentEvents ?? []).map((event) => ({
      id: `event-${event.id}`,
      category: "event" as const,
      title: humanizeValue(event.event_name),
      description: summarizeJson(event.event_properties),
      createdAt: event.created_at,
    })),
    ...(recentTransactions ?? []).map((transaction) => ({
      id: `transaction-${transaction.id}`,
      category: "billing" as const,
      title: `${transaction.type === "income" ? "Income" : "Expense"} • ${humanizeValue(transaction.category)}`,
      description: transaction.note ?? `${formatEuroAmount(transaction.amount)} € on ${transaction.date}`,
      createdAt: transaction.created_at,
    })),
    ...((notes ?? []).map((note) => ({
      id: `note-${note.id}`,
      category: "note" as const,
      title: `${humanizeValue(note.note_type)} note`,
      description: note.body,
      createdAt: note.created_at,
    })) ?? []),
    ...((adminAuditLogs ?? []).map((log) => ({
      id: `audit-${log.id}`,
      category: "admin" as const,
      title: humanizeValue(log.action_type),
      description:
        log.reason ??
        `${log.category} action by ${
          log.actor_admin_id
            ? adminLabelById.get(log.actor_admin_id) ?? log.actor_admin_id
            : "unknown admin"
        }`,
      createdAt: log.created_at,
    })) ?? []),
    ...(subscription
      ? [
          {
            id: `subscription-${subscription.id}`,
            category: "subscription" as const,
            title: `${humanizeValue(subscription.plan)} subscription`,
            description: `${humanizeValue(subscription.status)} on ${subscription.platform ?? "unknown platform"}`,
            createdAt: subscription.updated_at,
          },
        ]
      : []),
  ]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 24);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="h-8 w-8">
          <Link href="/admin/users">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-neutral-900">{displayName}</h1>
            <Badge variant={user.is_email_verified ? "success" : "warning"}>
              {user.is_email_verified ? "Verified" : "Unverified"}
            </Badge>
            <Badge
              variant={
                subscription ? getSubscriptionBadgeVariant(subscription.status) : "secondary"
              }
              className="capitalize"
            >
              {subscription
                ? hasElevatedAccess(subscription)
                  ? `${subscription.plan} access`
                  : subscription.status
                : "No access"}
            </Badge>
          </div>
          <p className="text-sm text-neutral-500">{user.email}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Access state</p>
            <p className="mt-2 text-2xl font-semibold text-neutral-900">
              {subscription ? subscription.plan : "none"}
            </p>
            <p className="mt-1 text-xs text-neutral-500 capitalize">
              {subscription
                ? `${subscription.status}${subscription.platform ? ` • ${subscription.platform}` : ""}`
                : "Manual grant available"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Events in 7 days</p>
            <p className="mt-2 text-2xl font-semibold text-neutral-900">{eventsLast7d}</p>
            <p className="mt-1 text-xs text-neutral-500">
              {topEventsLast7d[0] ? `Top: ${topEventsLast7d[0][0]}` : "No recent activity"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-neutral-500">
              Transactions in 30 days
            </p>
            <p className="mt-2 text-2xl font-semibold text-neutral-900">{transactionsLast30d}</p>
            <p className="mt-1 text-xs text-neutral-500">
              Net {net30d >= 0 ? "+" : "-"}
              {formatEuroAmount(Math.abs(net30d))} €
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Edit User</CardTitle>
              <CardDescription>
                Update profile fields, verification state, and profile assets.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UserEditForm user={user} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recent Transactions</CardTitle>
              <CardDescription>
                Latest wallet activity. Last 30 days net:{" "}
                <span className={net30d >= 0 ? "text-green-600" : "text-red-600"}>
                  {net30d >= 0 ? "+" : "-"}
                  {formatEuroAmount(Math.abs(net30d))} €
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {!recentTransactions?.length ? (
                <div className="px-6 py-8 text-center text-sm text-neutral-400">
                  No transactions found.
                </div>
              ) : (
                <div className="divide-y divide-neutral-100">
                  {recentTransactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-6 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-neutral-900 capitalize">
                          {tx.category}
                        </p>
                        <p className="text-xs text-neutral-500">{tx.note ?? tx.date}</p>
                      </div>
                      <span
                        className={`text-sm font-semibold ${
                          tx.type === "income" ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {tx.type === "income" ? "+" : "-"}
                        {formatEuroAmount(tx.amount)} €
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recent Events</CardTitle>
              <CardDescription>Latest behavioral signals, payloads and device hints.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {!recentEvents?.length ? (
                <div className="px-6 py-8 text-center text-sm text-neutral-400">
                  No events found.
                </div>
              ) : (
                <div className="divide-y divide-neutral-100">
                  {recentEvents.map((event) => {
                    const device = deviceSummary(event.device_info, event.event_properties);
                    return (
                      <div key={event.id} className="px-6 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium text-neutral-900">{event.event_name}</p>
                          <p className="text-xs text-neutral-500">{formatDate(event.created_at)}</p>
                        </div>
                        {device ? (
                          <p className="mt-1 text-xs text-neutral-500">{device}</p>
                        ) : null}
                        <p className="mt-2 text-xs text-neutral-500">
                          {summarizeJson(event.event_properties)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <UserNotesPanel
            userId={id}
            notes={(notes ?? []).map((note) => ({
              ...note,
              authorLabel: note.author_admin_id
                ? adminLabelById.get(note.author_admin_id) ?? note.author_admin_id
                : "Unknown admin",
            }))}
            canManageNotes={
              hasPermission(adminContext, "support.notes.manage") ||
              hasPermission(adminContext, "finance.notes.manage")
            }
          />

          {canViewSupportHandoffs ? (
            <SupportHandoffsPanel
              userId={id}
              handoffs={supportHandoffs.map((handoff) => ({
                ...handoff,
                fromLabel: handoff.from_admin_id
                  ? adminLabelById.get(handoff.from_admin_id) ?? handoff.from_admin_id
                  : "Unknown admin",
                toLabel: handoff.to_admin_id
                  ? adminLabelById.get(handoff.to_admin_id) ?? handoff.to_admin_id
                  : null,
              }))}
              adminOptions={(adminDirectory ?? []).map((admin) => ({
                id: admin.id,
                label: admin.display_name ?? admin.username,
              }))}
              canManageSupport={canManageSupportHandoffs}
            />
          ) : null}

          <UserTimelinePanel items={timelineItems} />
        </div>

        <div className="space-y-4">
          <UserControlCenter
            user={{
              id: user.id,
              email: user.email,
              display_name: user.display_name,
              is_email_verified: user.is_email_verified,
              status: user.status,
            }}
            subscription={subscription}
            capabilities={{
              canEditUsers: hasPermission(adminContext, "users.edit"),
              canSuspendUsers: hasPermission(adminContext, "users.suspend"),
              canBanUsers: hasPermission(adminContext, "users.ban"),
              canReactivateUsers: hasPermission(adminContext, "users.reactivate"),
              canSoftDeleteUsers: hasPermission(adminContext, "users.soft_delete"),
              canManageSubscriptions: hasPermission(adminContext, "subscriptions.manage"),
              canReviewUsers: hasPermission(adminContext, "review_queue.manage"),
            }}
          />

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Account Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-neutral-500">Account status</p>
                <Badge variant={user.status === "active" ? "success" : "warning"} className="mt-1 capitalize">
                  {humanizeValue(user.status)}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-neutral-500">Email verification</p>
                <Badge
                  variant={user.is_email_verified ? "success" : "warning"}
                  className="mt-1 text-xs"
                >
                  {user.is_email_verified ? "Verified" : "Unverified"}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-neutral-500">Member since</p>
                <p className="mt-0.5 text-sm text-neutral-900">{formatDate(user.created_at)}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500">Last active</p>
                <p className="mt-0.5 text-sm text-neutral-900">
                  {effectiveLastActiveAt ? formatDate(effectiveLastActiveAt) : "Never"}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500">Risk profile</p>
                <p className="mt-0.5 text-sm text-neutral-900">
                  Score {user.risk_score ?? 0}
                  {user.risk_status ? ` • ${humanizeValue(user.risk_status)}` : ""}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500">Profile image URL</p>
                <p className="mt-0.5 break-all text-xs text-neutral-500">
                  {user.profile_image_url ?? "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500">User ID</p>
                <p className="mt-0.5 break-all font-mono text-xs text-neutral-500">{user.id}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Behavior Snapshot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-neutral-500">Access strength</p>
                <p className="mt-0.5 text-sm text-neutral-900">
                  {hasElevatedAccess(subscription)
                    ? "Paid/trial access enabled"
                    : subscription
                      ? "Basic or inactive access"
                      : "No subscription record"}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500">Top events in 7 days</p>
                {topEventsLast7d.length ? (
                  <div className="mt-1 flex flex-wrap gap-2">
                    {topEventsLast7d.map(([eventName, eventCount]) => (
                      <Badge
                        key={eventName}
                        variant="secondary"
                        className="gap-1 bg-neutral-100 text-neutral-700"
                      >
                        {eventName}
                        <span className="text-[10px] text-neutral-500">{eventCount}</span>
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="mt-0.5 text-sm text-neutral-400">No event signal yet.</p>
                )}
              </div>
              <div>
                <p className="text-xs text-neutral-500">Recent subscription status</p>
                {subscription ? (
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge
                      variant={planVariant[subscription.plan] ?? "secondary"}
                      className="capitalize"
                    >
                      {subscription.plan}
                    </Badge>
                    <Badge
                      variant={getSubscriptionBadgeVariant(subscription.status)}
                      className="capitalize"
                    >
                      {subscription.status}
                    </Badge>
                  </div>
                ) : (
                  <p className="mt-0.5 text-sm text-neutral-400">No subscription found.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <UserTagsPanel
            userId={id}
            allTags={allTags ?? []}
            assignedTags={assignedTags}
            canManageTags={hasPermission(adminContext, "tags.manage")}
          />

          <UserFlagsPanel
            userId={id}
            allFlags={allFlags ?? []}
            activeFlags={activeFlags}
            canManageFlags={hasPermission(adminContext, "flags.manage")}
          />

          {canViewUserSessions ? (
            <UserSecurityPanel
              userId={id}
              sessions={securityData.sessions}
              devices={securityData.devices}
              canManageSessions={canManageUserSessions}
            />
          ) : null}

          {canViewAuditHistory ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Admin Action History</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {adminAuditLogs?.length ? (
                  adminAuditLogs.map((log) => (
                    <div key={log.id} className="rounded-lg border border-neutral-200 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium text-neutral-900">{log.action_type}</p>
                        <p className="text-xs text-neutral-500">{formatDate(log.created_at)}</p>
                      </div>
                      <p className="mt-1 text-xs text-neutral-500">
                        {log.category} • {log.severity} •{" "}
                        {log.actor_admin_id
                          ? adminLabelById.get(log.actor_admin_id) ?? log.actor_admin_id
                          : "Unknown admin"}
                      </p>
                      {log.reason ? (
                        <p className="mt-2 text-sm text-neutral-700">{log.reason}</p>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-neutral-400">
                    No admin actions logged for this user yet.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
