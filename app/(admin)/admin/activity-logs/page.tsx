import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/shared/page-header";
import { ActivityLogsClient } from "./activity-logs-client";
import { parsePage } from "@/lib/table-params";
import type { Json } from "@/types/database";
import { requirePermission } from "@/lib/admin/permissions";
import {
  buildOnlineUserIds,
  USER_SESSION_STATE_EVENTS,
} from "@/lib/user-activity";

export const revalidate = 0;

const EVENT_PAGE_SIZE = 30;
const ANALYTICS_FETCH_LIMIT = 50000;
const ANALYTICS_BATCH_SIZE = 1000;
const ERROR_EVENT_KEYWORDS = ["error", "fail", "exception", "timeout", "denied"];
const ONLINE_WINDOW_SECONDS = 12;
const SESSION_STATE_LOOKBACK_HOURS = 24;

type TimeWindow =
  | "1h"
  | "3h"
  | "6h"
  | "12h"
  | "24h"
  | "3d"
  | "7d"
  | "14d"
  | "30d"
  | "90d"
  | "180d"
  | "all";
type ActivityScope = "all" | "known" | "anonymous";
type ChartType = "bars" | "line" | "area";

interface ActivityEventRow {
  id: string;
  event_name: string;
  user_id: string | null;
  session_id: string | null;
  event_properties: Json | null;
  device_info: Json | null;
  created_at: string;
}

interface UserLookupRow {
  id: string;
  email: string;
  display_name: string | null;
}

interface TrendPoint {
  id: string;
  label: string;
  shortLabel: string;
  count: number;
}

interface FeedRow {
  id: string;
  eventName: string;
  actionTitle: string;
  actionMeta: string;
  previousEvent: string | null;
  userId: string | null;
  userName: string;
  userEmail: string | null;
  sessionId: string | null;
  device: string;
  path: string | null;
  propertiesPreview: string;
  createdAt: string;
  firstSeenAt: string;
  repeatCount: number;
}

interface TopEventRow {
  id: string;
  eventName: string;
  count: number;
  share: number;
}

interface TopUserRow {
  id: string;
  userId: string;
  displayName: string;
  email: string;
  events: number;
  sessions: number;
  errorEvents: number;
  lastSeen: string | null;
}

interface TransitionRow {
  id: string;
  from: string;
  to: string;
  count: number;
}

interface MonitoringSummary {
  totalEvents: number;
  knownEvents: number;
  anonymousEvents: number;
  activeNowUsers: number;
  uniqueUsers: number;
  uniqueSessions: number;
  avgEventsPerUser: number;
  errorEvents: number;
  peakLabel: string;
  peakCount: number;
  sampled: boolean;
  sampledRows: number;
  sampleFromTotal: number;
}

function parseTimeWindow(value: string | undefined): TimeWindow {
  if (
    value === "1h" ||
    value === "3h" ||
    value === "6h" ||
    value === "12h" ||
    value === "24h" ||
    value === "3d" ||
    value === "7d" ||
    value === "14d" ||
    value === "30d" ||
    value === "90d" ||
    value === "180d" ||
    value === "all"
  ) {
    return value;
  }
  return "7d";
}

function parseScope(value: string | undefined): ActivityScope {
  if (value === "known" || value === "anonymous" || value === "all") {
    return value;
  }
  return "all";
}

function parseChartType(value: string | undefined): ChartType {
  if (value === "bars" || value === "line" || value === "area") {
    return value;
  }
  return "bars";
}

function getNowDate(): Date {
  return new Date();
}

function getWindowStart(window: TimeWindow): string | null {
  if (window === "all") return null;
  const now = getNowDate().getTime();
  const hourMs = 60 * 60 * 1000;
  const dayMs = 24 * hourMs;
  if (window === "1h") return new Date(now - hourMs).toISOString();
  if (window === "3h") return new Date(now - 3 * hourMs).toISOString();
  if (window === "6h") return new Date(now - 6 * hourMs).toISOString();
  if (window === "12h") return new Date(now - 12 * hourMs).toISOString();
  if (window === "24h") return new Date(now - dayMs).toISOString();
  if (window === "3d") return new Date(now - 3 * dayMs).toISOString();
  if (window === "7d") return new Date(now - 7 * dayMs).toISOString();
  if (window === "14d") return new Date(now - 14 * dayMs).toISOString();
  if (window === "30d") return new Date(now - 30 * dayMs).toISOString();
  if (window === "90d") return new Date(now - 90 * dayMs).toISOString();
  return new Date(now - 180 * dayMs).toISOString();
}

function summarizeJson(value: Json | null, maxLength = 180): string {
  if (!value) return "-";
  const raw = JSON.stringify(value);
  if (raw.length <= maxLength) return raw;
  return `${raw.slice(0, maxLength)}...`;
}

function inferPlatformFromSource(value: string | null): string | null {
  if (!value) return null;
  const source = value.toLowerCase();
  if (source.includes("ios") || source.includes("iphone") || source.includes("ipad")) {
    return "iOS (inferred)";
  }
  if (source.includes("android")) {
    return "Android (inferred)";
  }
  if (source.includes("web") || source.includes("dashboard") || source.includes("browser")) {
    return "Web (inferred)";
  }
  return null;
}

function deviceLabel(deviceInfo: Json | null, eventProperties: Json | null): string {
  if (deviceInfo && typeof deviceInfo === "object" && !Array.isArray(deviceInfo)) {
    const obj = deviceInfo as Record<string, Json | undefined>;
    const parts = [obj.platform, obj.os, obj.browser, obj.device]
      .map((part) => (typeof part === "string" ? part.trim() : ""))
      .filter(Boolean);
    if (parts.length) return parts.join(" / ");
  }

  const props =
    eventProperties && typeof eventProperties === "object" && !Array.isArray(eventProperties)
      ? (eventProperties as Record<string, Json | undefined>)
      : null;
  if (props) {
    const parts = [props.platform, props.os, props.device]
      .map((part) => (typeof part === "string" ? part.trim() : ""))
      .filter(Boolean);
    if (parts.length) return parts.join(" / ");

    const inferred = inferPlatformFromSource(
      typeof props.source === "string" ? props.source : null
    );
    if (inferred) return inferred;
  }

  return "Unknown (metadata missing)";
}

function isErrorLikeEvent(eventName: string): boolean {
  const normalized = eventName.toLowerCase();
  return ERROR_EVENT_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function formatBucketDateLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function formatBucketMonthLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit" }).format(date);
}

function formatBucketHourLabel(date: Date, withMinutes = false): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: withMinutes ? "2-digit" : undefined,
    hour12: false,
  }).format(date);
}

interface BucketConfig {
  bucketMs: number;
  bucketCount: number;
  label: (date: Date) => string;
  shortLabel: (date: Date) => string;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const FIXED_BUCKET_CONFIG: Record<Exclude<TimeWindow, "all">, BucketConfig> = {
  "1h": {
    bucketMs: 60 * 1000,
    bucketCount: 60,
    label: (date) => formatBucketHourLabel(date, true),
    shortLabel: (date) => formatBucketHourLabel(date, true),
  },
  "3h": {
    bucketMs: 5 * 60 * 1000,
    bucketCount: 36,
    label: (date) => formatBucketHourLabel(date, true),
    shortLabel: (date) => formatBucketHourLabel(date, true),
  },
  "6h": {
    bucketMs: 10 * 60 * 1000,
    bucketCount: 36,
    label: (date) => formatBucketHourLabel(date, true),
    shortLabel: (date) => formatBucketHourLabel(date, true),
  },
  "12h": {
    bucketMs: 15 * 60 * 1000,
    bucketCount: 48,
    label: (date) => formatBucketHourLabel(date, true),
    shortLabel: (date) => formatBucketHourLabel(date, true),
  },
  "24h": {
    bucketMs: 30 * 60 * 1000,
    bucketCount: 48,
    label: (date) => formatBucketHourLabel(date, true),
    shortLabel: (date) => formatBucketHourLabel(date),
  },
  "3d": {
    bucketMs: HOUR_MS,
    bucketCount: 72,
    label: (date) =>
      new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        hour12: false,
      }).format(date),
    shortLabel: (date) => formatBucketHourLabel(date),
  },
  "7d": {
    bucketMs: 3 * HOUR_MS,
    bucketCount: 56,
    label: (date) =>
      new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        hour12: false,
      }).format(date),
    shortLabel: (date) =>
      new Intl.DateTimeFormat("en-US", { month: "numeric", day: "numeric" }).format(date),
  },
  "14d": {
    bucketMs: 6 * HOUR_MS,
    bucketCount: 56,
    label: (date) =>
      new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        hour12: false,
      }).format(date),
    shortLabel: (date) =>
      new Intl.DateTimeFormat("en-US", { month: "numeric", day: "numeric" }).format(date),
  },
  "30d": {
    bucketMs: 12 * HOUR_MS,
    bucketCount: 60,
    label: (date) => formatBucketDateLabel(date),
    shortLabel: (date) =>
      new Intl.DateTimeFormat("en-US", { month: "numeric", day: "numeric" }).format(date),
  },
  "90d": {
    bucketMs: 2 * DAY_MS,
    bucketCount: 45,
    label: (date) => formatBucketDateLabel(date),
    shortLabel: (date) =>
      new Intl.DateTimeFormat("en-US", { month: "numeric", day: "numeric" }).format(date),
  },
  "180d": {
    bucketMs: 3 * DAY_MS,
    bucketCount: 60,
    label: (date) => formatBucketDateLabel(date),
    shortLabel: (date) =>
      new Intl.DateTimeFormat("en-US", { month: "numeric", day: "numeric" }).format(date),
  },
};

function buildTrendBuckets(
  rows: ActivityEventRow[],
  window: TimeWindow
): { trend: TrendPoint[]; peakLabel: string; peakCount: number } {
  const now = getNowDate();
  let bucketStarts: Date[] = [];
  let bucketId = (date: Date): string => date.toISOString();
  let label = (date: Date): string => formatBucketDateLabel(date);
  let shortLabel = (date: Date): string => formatBucketDateLabel(date);
  let indexFromTime: (value: number) => number = () => -1;

  if (window === "all") {
    const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    base.setUTCMonth(base.getUTCMonth() - 11);
    bucketStarts = Array.from({ length: 12 }, (_, i) => {
      const date = new Date(base);
      date.setUTCMonth(base.getUTCMonth() + i);
      return date;
    });
    bucketId = (date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    label = (date) => formatBucketMonthLabel(date);
    shortLabel = (date) =>
      new Intl.DateTimeFormat("en-US", { month: "short" }).format(date);
    const startYear = bucketStarts[0]?.getUTCFullYear() ?? now.getUTCFullYear();
    const startMonth = bucketStarts[0]?.getUTCMonth() ?? now.getUTCMonth();
    indexFromTime = (time) => {
      const date = new Date(time);
      return (date.getUTCFullYear() - startYear) * 12 + (date.getUTCMonth() - startMonth);
    };
  } else {
    const config = FIXED_BUCKET_CONFIG[window];
    const nowTs = now.getTime();
    const alignedNowTs = nowTs - (nowTs % config.bucketMs);
    const startTs = alignedNowTs - (config.bucketCount - 1) * config.bucketMs;

    bucketStarts = Array.from(
      { length: config.bucketCount },
      (_, index) => new Date(startTs + index * config.bucketMs)
    );
    bucketId = (date) => date.toISOString();
    label = config.label;
    shortLabel = config.shortLabel;
    indexFromTime = (time) => Math.floor((time - startTs) / config.bucketMs);
  }

  const trend = bucketStarts.map((date) => ({
    id: bucketId(date),
    label: label(date),
    shortLabel: shortLabel(date),
    count: 0,
  }));

  for (const row of rows) {
    const time = Date.parse(row.created_at);
    if (Number.isNaN(time)) continue;
    const index = indexFromTime(time);
    if (index < 0 || index >= trend.length) continue;
    trend[index].count += 1;
  }

  let peak = trend[0] ?? { label: "-", count: 0 };
  for (const point of trend) {
    if (point.count > peak.count) peak = point;
  }

  return {
    trend,
    peakLabel: peak.label,
    peakCount: peak.count,
  };
}

function averagePerUser(totalEvents: number, uniqueUsers: number): number {
  if (uniqueUsers === 0) return 0;
  return totalEvents / uniqueUsers;
}

function safePercent(part: number, total: number): number {
  if (total <= 0) return 0;
  return (part / total) * 100;
}

function toJsonObject(value: Json | null): Record<string, Json | undefined> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, Json | undefined>;
}

function getJsonString(
  obj: Record<string, Json | undefined> | null,
  key: string
): string | null {
  if (!obj) return null;
  const value = obj[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function humanizeIdentifier(value: string): string {
  const normalized = value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  if (!normalized) return value;
  return normalized
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function buildActionSummary(
  eventName: string,
  eventProperties: Json | null
): { title: string; meta: string; path: string | null } {
  const props = toJsonObject(eventProperties);
  const scope = getJsonString(props, "scope");
  const feature = getJsonString(props, "feature");
  const path = getJsonString(props, "path");
  const source = getJsonString(props, "source");
  const screen = getJsonString(props, "screen");
  const action = getJsonString(props, "action");
  const target = getJsonString(props, "target");
  const plan = getJsonString(props, "plan");
  const status = getJsonString(props, "status");

  if (eventName === "session_start") {
    const parts = [path ? `Path: ${path}` : null, source ? `Source: ${source}` : null].filter(
      Boolean
    ) as string[];
    return {
      title: "Started Session",
      meta: parts.join(" | ") || "Session initialized",
      path,
    };
  }

  if (eventName === "feature_usage") {
    const featureLabel = feature ? humanizeIdentifier(feature) : "Feature";
    const parts = [scope ? `Scope: ${scope}` : null, path ? `Path: ${path}` : null].filter(
      Boolean
    ) as string[];
    return {
      title: `Used ${featureLabel}`,
      meta: parts.join(" | ") || "Feature interaction",
      path,
    };
  }

  const baseTitle = humanizeIdentifier(eventName);
  const title =
    action && target
      ? `${humanizeIdentifier(action)} ${humanizeIdentifier(target)}`
      : action
      ? `${humanizeIdentifier(action)} (${baseTitle})`
      : baseTitle;

  const parts = [
    scope ? `Scope: ${scope}` : null,
    screen ? `Screen: ${screen}` : null,
    path ? `Path: ${path}` : null,
    source ? `Source: ${source}` : null,
    feature ? `Feature: ${humanizeIdentifier(feature)}` : null,
    plan ? `Plan: ${plan}` : null,
    status ? `Status: ${status}` : null,
  ].filter(Boolean) as string[];

  return {
    title,
    meta: parts.join(" | ") || "Event captured",
    path,
  };
}

function canMergeBurst(current: FeedRow, next: FeedRow): boolean {
  if (current.userId !== next.userId) return false;
  if (current.sessionId !== next.sessionId) return false;
  if (current.eventName !== next.eventName) return false;
  if (current.actionTitle !== next.actionTitle) return false;
  if (current.actionMeta !== next.actionMeta) return false;

  const currentTs = Date.parse(current.createdAt);
  const nextTs = Date.parse(next.createdAt);
  if (Number.isNaN(currentTs) || Number.isNaN(nextTs)) return false;
  const gapMs = currentTs - nextTs;
  return gapMs >= 0 && gapMs <= 2 * 60 * 1000;
}

function compressFeedRows(rows: FeedRow[]): FeedRow[] {
  const compressed: FeedRow[] = [];
  for (const row of rows) {
    const last = compressed[compressed.length - 1];
    if (last && canMergeBurst(last, row)) {
      last.repeatCount += 1;
      last.firstSeenAt = row.createdAt;
      if (!last.previousEvent && row.previousEvent) {
        last.previousEvent = row.previousEvent;
      }
      continue;
    }
    compressed.push({ ...row });
  }
  return compressed;
}

export default async function ActivityLogsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    search?: string;
    status?: string;
    event?: string;
    scope?: string;
    window?: string;
    user?: string;
    chart?: string;
  }>;
}) {
  await requirePermission("activity_logs.view");
  const params = await searchParams;
  const page = parsePage(params.page);
  const pageSize = EVENT_PAGE_SIZE;
  const search = params.search?.trim() ?? "";
  const eventName = params.event?.trim() || params.status?.trim() || "all";
  const scope = parseScope(params.scope);
  const timeWindow = parseTimeWindow(params.window);
  const chartType = parseChartType(params.chart);
  const userSearch = params.user?.trim() ?? "";
  const windowStart = getWindowStart(timeWindow);

  const supabase = createAdminClient();

  let matchedUserIds: string[] | null = null;
  if (userSearch) {
    if (scope === "anonymous") {
      matchedUserIds = [];
    } else {
      const { data: matchedUsersByText } = await supabase
        .from("users")
        .select("id")
        .or(`email.ilike.%${userSearch}%,display_name.ilike.%${userSearch}%`)
        .limit(300);
      const idsByText = (matchedUsersByText ?? []).map((row) => row.id);

      const looksLikeUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          userSearch
        );
      if (looksLikeUuid) {
        const { data: matchedById } = await supabase
          .from("users")
          .select("id")
          .eq("id", userSearch)
          .limit(1);
        matchedUserIds = Array.from(
          new Set([...(idsByText ?? []), ...((matchedById ?? []).map((row) => row.id))])
        );
      } else {
        matchedUserIds = idsByText;
      }
    }
  }
  const noUserMatches = matchedUserIds !== null && matchedUserIds.length === 0;

  const onlineNowSinceIso = new Date(
    getNowDate().getTime() - ONLINE_WINDOW_SECONDS * 1000
  ).toISOString();
  const sessionStateSinceIso = new Date(
    getNowDate().getTime() - SESSION_STATE_LOOKBACK_HOURS * 60 * 60 * 1000
  ).toISOString();

  let onlineNowUserIds: string[] = [];
  if (!noUserMatches && scope !== "anonymous") {
    let sessionStateQuery = supabase
      .from("events")
      .select("user_id,session_id,event_name,created_at")
      .not("user_id", "is", null)
      .in("event_name", [...USER_SESSION_STATE_EVENTS])
      .gte("created_at", sessionStateSinceIso)
      .order("created_at", { ascending: false })
      .limit(3000);

    let recentEventsQuery = supabase
      .from("events")
      .select("user_id,session_id,event_name,created_at")
      .not("user_id", "is", null)
      .gte("created_at", onlineNowSinceIso)
      .order("created_at", { ascending: false })
      .limit(3000);

    if (matchedUserIds) {
      sessionStateQuery = sessionStateQuery.in("user_id", matchedUserIds);
      recentEventsQuery = recentEventsQuery.in("user_id", matchedUserIds);
    }

    const [{ data: sessionStateRows }, { data: recentEventRows }] = await Promise.all([
      sessionStateQuery,
      recentEventsQuery,
    ]);

    onlineNowUserIds = buildOnlineUserIds({
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
  }

  let eventOptions: string[] = [];
  if (!noUserMatches) {
    let optionQuery = supabase
      .from("events")
      .select("event_name")
      .order("event_name", { ascending: true })
      .limit(2000);

    if (windowStart) {
      optionQuery = optionQuery.gte("created_at", windowStart);
    }
    if (scope === "known") {
      optionQuery = optionQuery.not("user_id", "is", null);
    } else if (scope === "anonymous") {
      optionQuery = optionQuery.is("user_id", null);
    }
    if (matchedUserIds) {
      optionQuery = optionQuery.in("user_id", matchedUserIds);
    }
    const { data: optionRows } = await optionQuery;
    eventOptions = Array.from(new Set((optionRows ?? []).map((row) => row.event_name)))
      .filter(Boolean)
      .map(String)
      .sort((a, b) => a.localeCompare(b));
  }

  let totalCount = 0;
  let totalPages = 0;
  let pageEvents: ActivityEventRow[] = [];
  if (!noUserMatches) {
    let query = supabase
      .from("events")
      .select(
        "id,event_name,user_id,session_id,event_properties,device_info,created_at",
        { count: "exact" }
      );
    if (search) {
      query = query.ilike("event_name", `%${search}%`);
    }
    if (eventName !== "all") {
      query = query.eq("event_name", eventName);
    }
    if (windowStart) {
      query = query.gte("created_at", windowStart);
    }
    if (scope === "known") {
      query = query.not("user_id", "is", null);
    } else if (scope === "anonymous") {
      query = query.is("user_id", null);
    }
    if (matchedUserIds) {
      query = query.in("user_id", matchedUserIds);
    }

    query = query
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    const { data: pageEventsRaw, count } = await query;
    totalCount = count ?? 0;
    pageEvents = (pageEventsRaw ?? []) as ActivityEventRow[];
    totalPages = Math.ceil(totalCount / pageSize);
  }

  let knownEvents = 0;
  let anonymousEvents = 0;
  if (noUserMatches) {
    knownEvents = 0;
    anonymousEvents = 0;
  } else if (scope === "known") {
    knownEvents = totalCount;
  } else if (scope === "anonymous") {
    anonymousEvents = totalCount;
  } else {
    let knownQuery = supabase.from("events").select("*", { count: "exact", head: true });
    let anonymousQuery = supabase.from("events").select("*", { count: "exact", head: true });
    if (search) {
      knownQuery = knownQuery.ilike("event_name", `%${search}%`);
      anonymousQuery = anonymousQuery.ilike("event_name", `%${search}%`);
    }
    if (eventName !== "all") {
      knownQuery = knownQuery.eq("event_name", eventName);
      anonymousQuery = anonymousQuery.eq("event_name", eventName);
    }
    if (windowStart) {
      knownQuery = knownQuery.gte("created_at", windowStart);
      anonymousQuery = anonymousQuery.gte("created_at", windowStart);
    }
    if (matchedUserIds) {
      knownQuery = knownQuery.in("user_id", matchedUserIds);
      anonymousQuery = anonymousQuery.in("user_id", matchedUserIds);
    }
    const [{ count: knownCount }, { count: anonymousCount }] = await Promise.all([
      knownQuery.not("user_id", "is", null),
      anonymousQuery.is("user_id", null),
    ]);
    knownEvents = knownCount ?? 0;
    anonymousEvents = anonymousCount ?? 0;
  }

  const analyticsRows: ActivityEventRow[] = [];
  const sampleFromTotal = Math.min(totalCount, ANALYTICS_FETCH_LIMIT);
  if (sampleFromTotal > 0) {
    for (let offset = 0; offset < sampleFromTotal; offset += ANALYTICS_BATCH_SIZE) {
      let analyticsQuery = supabase
        .from("events")
        .select("id,event_name,user_id,session_id,event_properties,device_info,created_at");

      if (search) {
        analyticsQuery = analyticsQuery.ilike("event_name", `%${search}%`);
      }
      if (eventName !== "all") {
        analyticsQuery = analyticsQuery.eq("event_name", eventName);
      }
      if (windowStart) {
        analyticsQuery = analyticsQuery.gte("created_at", windowStart);
      }
      if (scope === "known") {
        analyticsQuery = analyticsQuery.not("user_id", "is", null);
      } else if (scope === "anonymous") {
        analyticsQuery = analyticsQuery.is("user_id", null);
      }
      if (matchedUserIds) {
        analyticsQuery = analyticsQuery.in("user_id", matchedUserIds);
      }

      const { data: batchRaw } = await analyticsQuery
        .order("created_at", { ascending: false })
        .range(offset, Math.min(offset + ANALYTICS_BATCH_SIZE - 1, sampleFromTotal - 1));

      const batch = (batchRaw ?? []) as ActivityEventRow[];
      analyticsRows.push(...batch);
      if (batch.length < ANALYTICS_BATCH_SIZE) break;
    }
  }

  analyticsRows.sort(
    (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at)
  );

  const uniqueUsers = new Set<string>();
  const uniqueSessions = new Set<string>();
  const eventCountByName = new Map<string, number>();
  const userStats = new Map<
    string,
    { events: number; sessions: Set<string>; errorEvents: number; lastSeen: string | null }
  >();
  const transitionCounts = new Map<string, number>();
  const lastEventByStream = new Map<string, string>();
  const previousEventById = new Map<string, string | null>();
  let errorEvents = 0;

  for (const row of analyticsRows) {
    eventCountByName.set(row.event_name, (eventCountByName.get(row.event_name) ?? 0) + 1);

    if (row.user_id) {
      uniqueUsers.add(row.user_id);
      const current = userStats.get(row.user_id) ?? {
        events: 0,
        sessions: new Set<string>(),
        errorEvents: 0,
        lastSeen: null,
      };
      current.events += 1;
      if (row.session_id) current.sessions.add(row.session_id);
      if (!current.lastSeen || row.created_at > current.lastSeen) {
        current.lastSeen = row.created_at;
      }
      if (isErrorLikeEvent(row.event_name)) current.errorEvents += 1;
      userStats.set(row.user_id, current);
    }

    if (row.session_id) {
      uniqueSessions.add(row.session_id);
    }

    if (isErrorLikeEvent(row.event_name)) {
      errorEvents += 1;
    }

    const streamKey = row.session_id
      ? `session:${row.session_id}`
      : row.user_id
      ? `user:${row.user_id}`
      : null;
    if (!streamKey) {
      previousEventById.set(row.id, null);
      continue;
    }
    const previousEvent = lastEventByStream.get(streamKey) ?? null;
    previousEventById.set(row.id, previousEvent);
    if (previousEvent) {
      const transitionKey = `${previousEvent}|||${row.event_name}`;
      transitionCounts.set(transitionKey, (transitionCounts.get(transitionKey) ?? 0) + 1);
    }
    lastEventByStream.set(streamKey, row.event_name);
  }

  const topEvents: TopEventRow[] = Array.from(eventCountByName.entries())
    .map(([name, value]) => ({
      id: name,
      eventName: name,
      count: value,
      share: safePercent(value, analyticsRows.length),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const topUserIds = Array.from(userStats.entries())
    .sort((a, b) => b[1].events - a[1].events)
    .slice(0, 12)
    .map(([userId]) => userId);

  const pageUserIds = Array.from(
    new Set(pageEvents.map((event) => event.user_id).filter(Boolean))
  ) as string[];
  const lookupUserIds = Array.from(new Set([...pageUserIds, ...topUserIds]));

  const { data: lookupUsers } = lookupUserIds.length
    ? await supabase
        .from("users")
        .select("id,email,display_name")
        .in("id", lookupUserIds)
    : { data: [] };
  const usersById = new Map<string, UserLookupRow>(
    (lookupUsers ?? []).map((user) => [user.id, user])
  );

  const topUsers: TopUserRow[] = topUserIds
    .map((userId) => {
      const stat = userStats.get(userId);
      if (!stat) return null;
      const user = usersById.get(userId);
      return {
        id: userId,
        userId,
        displayName: (user?.display_name ?? "Unnamed").trim(),
        email: user?.email ?? "-",
        events: stat.events,
        sessions: stat.sessions.size,
        errorEvents: stat.errorEvents,
        lastSeen: stat.lastSeen,
      };
    })
    .filter((row): row is TopUserRow => Boolean(row));

  const topTransitions: TransitionRow[] = Array.from(transitionCounts.entries())
    .map(([key, value]) => {
      const [from, to] = key.split("|||");
      return {
        id: key,
        from,
        to,
        count: value,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const { trend, peakLabel, peakCount } = buildTrendBuckets(analyticsRows, timeWindow);

  const feedRowsRaw: FeedRow[] = pageEvents.map((event) => {
    const user = event.user_id ? usersById.get(event.user_id) ?? null : null;
    const action = buildActionSummary(event.event_name, event.event_properties);
    return {
      id: event.id,
      eventName: event.event_name,
      actionTitle: action.title,
      actionMeta: action.meta,
      previousEvent: previousEventById.get(event.id) ?? null,
      userId: event.user_id,
      userName: user ? (user.display_name ?? "Unnamed").trim() : "Anonymous",
      userEmail: user?.email ?? null,
      sessionId: event.session_id,
      device: deviceLabel(event.device_info, event.event_properties),
      path: action.path,
      propertiesPreview: summarizeJson(event.event_properties),
      createdAt: event.created_at,
      firstSeenAt: event.created_at,
      repeatCount: 1,
    };
  });
  const feedRows = compressFeedRows(feedRowsRaw);

  const monitoringSummary: MonitoringSummary = {
    totalEvents: totalCount,
    knownEvents,
    anonymousEvents,
    activeNowUsers: onlineNowUserIds.length,
    uniqueUsers: uniqueUsers.size,
    uniqueSessions: uniqueSessions.size,
    avgEventsPerUser: averagePerUser(totalCount, uniqueUsers.size),
    errorEvents,
    peakLabel,
    peakCount,
    sampled: totalCount > ANALYTICS_FETCH_LIMIT,
    sampledRows: analyticsRows.length,
    sampleFromTotal: totalCount,
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Activity Intelligence"
        description="Advanced event analytics and live user behavior monitoring."
      />
      <ActivityLogsClient
        search={search}
        eventName={eventName}
        scope={scope}
        timeWindow={timeWindow}
        chartType={chartType}
        userSearch={userSearch}
        eventOptions={eventOptions}
        page={page}
        totalPages={totalPages}
        count={totalCount}
        pageSize={pageSize}
        monitoringSummary={monitoringSummary}
        trend={trend}
        topEvents={topEvents}
        topUsers={topUsers}
        topTransitions={topTransitions}
        feedRows={feedRows}
      />
    </div>
  );
}
