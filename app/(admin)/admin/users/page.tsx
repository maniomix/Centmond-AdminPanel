import { createAdminClient } from "@/lib/supabase/admin";
import { parsePage, parseSortBy, parseSortOrder } from "@/lib/table-params";
import { PageHeader } from "@/components/shared/page-header";
import { UsersTable } from "./users-table";
import {
  buildOnlineUserIds,
  buildLatestEventByUserMap,
  pickLatestIsoTimestamp,
  USER_SESSION_STATE_EVENTS,
} from "@/lib/user-activity";
import { hasPermission, requirePermission } from "@/lib/admin/permissions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const revalidate = 0;
const ONLINE_WINDOW_SECONDS = 12;
const SESSION_STATE_LOOKBACK_HOURS = 24;
const USER_ACTIVITY_LOOKBACK_HOURS = 24 * 7;

const USER_SORT_COLUMNS = [
  "display_name",
  "email",
  "status",
  "is_email_verified",
  "created_at",
  "last_active_at",
] as const;

type VerificationFilter = "all" | "verified" | "unverified";

function getNowDate(): Date {
  return new Date();
}

function buildRecentIso(seconds: number): string {
  return new Date(getNowDate().getTime() - seconds * 1000).toISOString();
}

function buildLookbackIso(hours: number): string {
  return new Date(getNowDate().getTime() - hours * 60 * 60 * 1000).toISOString();
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    search?: string;
    verification?: string;
    sortBy?: string;
    sortOrder?: string;
  }>;
}) {
  const adminContext = await requirePermission("users.view");
  const params = await searchParams;
  const page = parsePage(params.page);
  const pageSize = 20;
  const search = params.search?.trim() ?? "";
  const verification = (params.verification ?? "all") as VerificationFilter;
  const sortBy = parseSortBy(params.sortBy, USER_SORT_COLUMNS, "created_at");
  const sortOrder = parseSortOrder(params.sortOrder);
  const hasActiveFilters = search.length > 0 || verification !== "all";

  const supabase = createAdminClient();
  const onlineSinceIso = buildRecentIso(ONLINE_WINDOW_SECONDS);
  const sessionLookbackSinceIso = buildLookbackIso(SESSION_STATE_LOOKBACK_HOURS);
  const userActivitySinceIso = buildLookbackIso(USER_ACTIVITY_LOOKBACK_HOURS);

  const [{ data: sessionStateRows }, { data: recentEventRows }, { data: allTags }] = await Promise.all([
    supabase
      .from("events")
      .select("user_id,session_id,event_name,created_at")
      .not("user_id", "is", null)
      .in("event_name", [...USER_SESSION_STATE_EVENTS])
      .gte("created_at", sessionLookbackSinceIso)
      .order("created_at", { ascending: false })
      .limit(3000),
    supabase
      .from("events")
      .select("user_id,session_id,event_name,created_at")
      .not("user_id", "is", null)
      .gte("created_at", onlineSinceIso)
      .order("created_at", { ascending: false })
      .limit(3000),
    hasPermission(adminContext, "tags.manage")
      ? supabase.from("user_tags").select("id, key, label, color").order("label")
      : Promise.resolve({ data: [] }),
  ]);

  const onlineUserIds = buildOnlineUserIds({
    sessionStateRows: (sessionStateRows ?? []).map((row) => ({
      user_id: row.user_id,
      session_id: row.session_id,
      event_name: row.event_name,
      created_at: row.created_at,
    })),
    recentEventRows: (recentEventRows ?? []).map((row) => ({
      user_id: row.user_id,
      session_id: row.session_id,
      event_name: row.event_name,
      created_at: row.created_at,
    })),
    recentWindowSeconds: ONLINE_WINDOW_SECONDS,
  });

  const { data: onlineUsers } = onlineUserIds.length
    ? await supabase
        .from("users")
        .select("id, email, display_name")
        .in("id", onlineUserIds)
        .limit(8)
    : { data: [] };

  let query = supabase.from("users").select("*", { count: "exact" });

  if (search) {
    query = query.or(
      `email.ilike.%${search}%,display_name.ilike.%${search}%,username.ilike.%${search}%,full_name.ilike.%${search}%`
    );
  }

  if (verification === "verified") {
    query = query.eq("is_email_verified", true);
  } else if (verification === "unverified") {
    query = query.or("is_email_verified.is.false,is_email_verified.is.null");
  }

  query = query
    .order(sortBy, { ascending: sortOrder === "asc", nullsFirst: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  const { data: users, count } = await query;
  const userIds = (users ?? []).map((user) => user.id);

  const [{ data: subscriptions }, { data: latestEvents }, { data: recentActivityRows }] = userIds.length
    ? await Promise.all([
        supabase
          .from("subscriptions")
          .select("id, user_id, plan, status, updated_at, current_period_end, platform")
          .in("user_id", userIds)
          .order("updated_at", { ascending: false }),
        supabase
          .from("events")
          .select("user_id, created_at")
          .in("user_id", userIds)
          .order("created_at", { ascending: false })
          .limit(5000),
        supabase
          .from("events")
          .select("user_id, event_name")
          .in("user_id", userIds)
          .gte("created_at", userActivitySinceIso)
          .order("created_at", { ascending: false })
          .limit(5000),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const subscriptionByUserId = new Map<
    string,
    {
      id: string;
      plan: string;
      status: string;
      updated_at: string;
      current_period_end: string | null;
      platform: string | null;
    }
  >();

  for (const row of subscriptions ?? []) {
    if (!subscriptionByUserId.has(row.user_id)) {
      subscriptionByUserId.set(row.user_id, {
        id: row.id,
        plan: row.plan,
        status: row.status,
        updated_at: row.updated_at,
        current_period_end: row.current_period_end,
        platform: row.platform,
      });
    }
  }

  const activityByUserId = new Map<string, { eventCount: number; topEvent: string | null }>();
  const topEventCountByUserId = new Map<string, Map<string, number>>();
  for (const row of recentActivityRows ?? []) {
    if (!row.user_id) continue;
    const current = activityByUserId.get(row.user_id) ?? { eventCount: 0, topEvent: null };
    current.eventCount += 1;
    activityByUserId.set(row.user_id, current);

    const eventCounts = topEventCountByUserId.get(row.user_id) ?? new Map<string, number>();
    eventCounts.set(row.event_name, (eventCounts.get(row.event_name) ?? 0) + 1);
    topEventCountByUserId.set(row.user_id, eventCounts);
  }

  for (const [userId, eventCounts] of topEventCountByUserId.entries()) {
    let topEvent: string | null = null;
    let topEventCount = -1;
    for (const [eventName, eventCount] of eventCounts.entries()) {
      if (eventCount > topEventCount) {
        topEvent = eventName;
        topEventCount = eventCount;
      }
    }

    const current = activityByUserId.get(userId);
    if (current) {
      current.topEvent = topEvent;
      activityByUserId.set(userId, current);
    }
  }

  const latestEventByUserId = buildLatestEventByUserMap(latestEvents ?? []);
  const usersWithEffectiveLastSeen = (users ?? []).map((user) => ({
    ...user,
    last_active_at: pickLatestIsoTimestamp(
      user.last_active_at,
      latestEventByUserId.get(user.id) ?? null
    ),
  }));
  const visibleVerifiedCount = usersWithEffectiveLastSeen.filter(
    (user) => user.is_email_verified
  ).length;
  const visiblePremiumCount = usersWithEffectiveLastSeen.filter((user) => {
    const subscription = subscriptionByUserId.get(user.id);
    if (!subscription) return false;
    return (
      ["active", "trialing"].includes(subscription.status.toLowerCase()) &&
      subscription.plan.toLowerCase() !== "free"
    );
  }).length;
  const visibleActiveCount = usersWithEffectiveLastSeen.filter(
    (user) => (activityByUserId.get(user.id)?.eventCount ?? 0) > 0
  ).length;
  return (
    <div className="space-y-5">
      <PageHeader
        title="Users"
        description="Manage users, verification, access levels, and recent activity from one place."
      />
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-900">Active Users Now</p>
              <p className="text-xs text-neutral-500">
                Online only counts users with very recent activity from a session that has not explicitly closed.
              </p>
            </div>
            <Badge variant={onlineUserIds.length > 0 ? "success" : "secondary"}>
              {onlineUserIds.length} online
            </Badge>
          </div>
          {onlineUsers?.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {onlineUsers.map((user) => (
                <div
                  key={user.id}
                  className="inline-flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5"
                >
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="text-xs text-neutral-800">
                    {user.display_name?.trim() || user.email}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-xs text-neutral-400">No user is online right now.</p>
          )}
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-neutral-500">
              {hasActiveFilters ? "Matching users" : "Total users"}
            </p>
            <p className="mt-2 text-2xl font-semibold text-neutral-900">{count ?? 0}</p>
            <p className="mt-1 text-xs text-neutral-500">
              {hasActiveFilters
                ? "Current result set after search and filters."
                : "All users in the current workspace."}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Verified on page</p>
            <p className="mt-2 text-2xl font-semibold text-neutral-900">{visibleVerifiedCount}</p>
            <p className="mt-1 text-xs text-neutral-500">
              {usersWithEffectiveLastSeen.length - visibleVerifiedCount} still unverified.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Premium access</p>
            <p className="mt-2 text-2xl font-semibold text-neutral-900">{visiblePremiumCount}</p>
            <p className="mt-1 text-xs text-neutral-500">
              Active or trialing paid plans in the visible list.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Active in 7d</p>
            <p className="mt-2 text-2xl font-semibold text-neutral-900">{visibleActiveCount}</p>
            <p className="mt-1 text-xs text-neutral-500">
              Users with recorded activity during the last 7 days.
            </p>
          </CardContent>
        </Card>
      </div>
      <UsersTable
        users={usersWithEffectiveLastSeen}
        count={count ?? 0}
        page={page}
        pageSize={pageSize}
        search={search}
        verification={verification}
        sortBy={sortBy}
        sortOrder={sortOrder}
        subscriptionByUserId={Object.fromEntries(subscriptionByUserId)}
        onlineUserIds={onlineUserIds}
        activityByUserId={Object.fromEntries(activityByUserId)}
        allTags={allTags ?? []}
        capabilities={{
          canEditUsers: hasPermission(adminContext, "users.edit"),
          canSuspendUsers: hasPermission(adminContext, "users.suspend"),
          canBanUsers: hasPermission(adminContext, "users.ban"),
          canReactivateUsers: hasPermission(adminContext, "users.reactivate"),
          canSoftDeleteUsers: hasPermission(adminContext, "users.soft_delete"),
          canManageSubscriptions: hasPermission(adminContext, "subscriptions.manage"),
          canManageTags: hasPermission(adminContext, "tags.manage"),
          canRunBulkActions: hasPermission(adminContext, "bulk_actions.run"),
          canReviewUsers: hasPermission(adminContext, "reviews.manage"),
          canViewTransactions:
            hasPermission(adminContext, "billing.view") ||
            hasPermission(adminContext, "subscriptions.view"),
        }}
      />
    </div>
  );
}
