"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Pagination } from "@/components/shared/pagination";
import { LiveRefresh } from "@/components/shared/live-refresh";
import { DataTable } from "@/components/shared/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/lib/utils";

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

interface TrendPoint {
  id: string;
  label: string;
  shortLabel: string;
  count: number;
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

interface ActivityLogsClientProps {
  search: string;
  eventName: string;
  scope: ActivityScope;
  timeWindow: TimeWindow;
  chartType: ChartType;
  userSearch: string;
  eventOptions: string[];
  page: number;
  totalPages: number;
  count: number;
  pageSize: number;
  monitoringSummary: MonitoringSummary;
  trend: TrendPoint[];
  topEvents: TopEventRow[];
  topUsers: TopUserRow[];
  topTransitions: TransitionRow[];
  feedRows: FeedRow[];
}

function humanizeIdentifier(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatBurstWindow(startIso: string, endIso: string): string {
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return "";
  const totalSeconds = Math.max(1, Math.round((end - start) / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return `${minutes}m ${seconds}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

interface TrendGeometryPoint extends TrendPoint {
  x: number;
  y: number;
}

interface TrendGeometry {
  width: number;
  height: number;
  baselineY: number;
  maxValue: number;
  barWidth: number;
  points: TrendGeometryPoint[];
  linePath: string;
  areaPath: string;
}

function buildXAxisIndices(length: number, target = 6): number[] {
  if (length <= 0) return [];
  if (length === 1) return [0];
  const ticks = Math.min(target, length);
  const indices = new Set<number>();
  for (let i = 0; i < ticks; i += 1) {
    indices.add(Math.round((i * (length - 1)) / Math.max(1, ticks - 1)));
  }
  return Array.from(indices).sort((a, b) => a - b);
}

function buildTrendGeometry(trend: TrendPoint[]): TrendGeometry {
  const width = 1000;
  const height = 240;
  const paddingX = 18;
  const paddingTop = 14;
  const paddingBottom = 24;
  const plotWidth = width - paddingX * 2;
  const plotHeight = height - paddingTop - paddingBottom;
  const baselineY = paddingTop + plotHeight;
  const maxValue = Math.max(1, ...trend.map((point) => point.count));
  const barWidth = Math.max(2, plotWidth / Math.max(1, trend.length) - 2);

  const points = trend.map((point, index) => {
    const x =
      trend.length <= 1
        ? paddingX + plotWidth / 2
        : paddingX + (index / (trend.length - 1)) * plotWidth;
    const y = baselineY - (point.count / maxValue) * plotHeight;
    return { ...point, x, y };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
  const areaPath = points.length
    ? `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${baselineY.toFixed(2)} L ${points[0].x.toFixed(2)} ${baselineY.toFixed(2)} Z`
    : "";

  return {
    width,
    height,
    baselineY,
    maxValue,
    barWidth,
    points,
    linePath,
    areaPath,
  };
}

export function ActivityLogsClient({
  search,
  eventName,
  scope,
  timeWindow,
  chartType,
  userSearch,
  eventOptions,
  page,
  totalPages,
  count,
  pageSize,
  monitoringSummary,
  trend,
  topEvents,
  topUsers,
  topTransitions,
  feedRows,
}: ActivityLogsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [searchInput, setSearchInput] = useState(search);
  const [userInput, setUserInput] = useState(userSearch);
  const [activeTrendIndex, setActiveTrendIndex] = useState<number | null>(null);
  const trendGeometry = useMemo(() => buildTrendGeometry(trend), [trend]);
  const xAxisIndices = useMemo(() => buildXAxisIndices(trend.length), [trend.length]);
  const showPointMarkers = trend.length > 1 && trend.length <= 80;
  const activeTrendPoint =
    activeTrendIndex !== null ? trendGeometry.points[activeTrendIndex] ?? null : null;

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    setUserInput(userSearch);
  }, [userSearch]);

  useEffect(() => {
    if (searchInput === search && userInput === userSearch) return;
    const timer = setTimeout(() => {
      const params = new URLSearchParams({
        page: "1",
        search: searchInput,
        event: eventName,
        scope,
        window: timeWindow,
        chart: chartType,
        user: userInput,
      });
      router.replace(`${pathname}?${params.toString()}`);
    }, 400);
    return () => clearTimeout(timer);
  }, [
    chartType,
    eventName,
    pathname,
    router,
    scope,
    search,
    searchInput,
    timeWindow,
    userInput,
    userSearch,
  ]);

  function buildUrl(overrides: Record<string, string>) {
    const params = new URLSearchParams({
      page: String(page),
      search: searchInput,
      event: eventName,
      scope,
      window: timeWindow,
      chart: chartType,
      user: userInput,
      ...overrides,
    });
    return `${pathname}?${params.toString()}`;
  }

  const feedColumns = useMemo(
    () => [
      {
        key: "eventName",
        label: "Action",
        render: (row: FeedRow) => (
          <div className="space-y-1">
            <p className="font-medium text-neutral-900">{row.actionTitle}</p>
            <p className="text-xs text-neutral-500">{row.actionMeta}</p>
            {row.previousEvent && (
              <p className="text-xs text-neutral-400">
                After: {humanizeIdentifier(row.previousEvent)}
              </p>
            )}
          </div>
        ),
      },
      {
        key: "userName",
        label: "User",
        render: (row: FeedRow) => (
          <div>
            <p className="text-sm font-medium text-neutral-900">{row.userName}</p>
            <p className="text-xs text-neutral-500">{row.userEmail ?? "Anonymous user"}</p>
          </div>
        ),
      },
      {
        key: "sessionId",
        label: "Session",
        render: (row: FeedRow) => (
          <div className="space-y-1">
            <span className="font-mono text-xs text-neutral-500">
              {row.sessionId ?? "-"}
            </span>
            {row.repeatCount > 1 && (
              <Badge variant="secondary" className="text-[10px]">
                x{row.repeatCount} burst
              </Badge>
            )}
          </div>
        ),
      },
      {
        key: "device",
        label: "Device",
        render: (row: FeedRow) => (
          <div>
            <p className="text-sm text-neutral-600">{row.device}</p>
            <p className="text-xs text-neutral-500">{row.path ?? "-"}</p>
          </div>
        ),
      },
      {
        key: "createdAt",
        label: "Timestamp",
        render: (row: FeedRow) => (
          <div>
            <p className="text-sm text-neutral-600">{formatDate(row.createdAt)}</p>
            {row.repeatCount > 1 && (
              <p className="text-xs text-neutral-500">
                Burst window: {formatBurstWindow(row.firstSeenAt, row.createdAt)}
              </p>
            )}
          </div>
        ),
      },
      {
        key: "actions",
        label: "",
        className: "w-24",
        render: (row: FeedRow) => (
          row.userId ? (
            <Button size="sm" variant="outline" asChild>
              <Link href={`/admin/users/${row.userId}`}>User</Link>
            </Button>
          ) : (
            <span className="text-xs text-neutral-400">-</span>
          )
        ),
      },
    ],
    []
  );

  const topUserColumns = useMemo(
    () => [
      {
        key: "displayName",
        label: "User",
        render: (row: TopUserRow) => (
          <div>
            <p className="font-medium text-neutral-900">{row.displayName}</p>
            <p className="text-xs text-neutral-500">{row.email}</p>
          </div>
        ),
      },
      {
        key: "events",
        label: "Events",
        render: (row: TopUserRow) => <span className="font-medium">{row.events}</span>,
      },
      {
        key: "sessions",
        label: "Sessions",
        render: (row: TopUserRow) => <span>{row.sessions}</span>,
      },
      {
        key: "errorEvents",
        label: "Errors",
        render: (row: TopUserRow) => (
          <Badge variant={row.errorEvents > 0 ? "destructive" : "success"}>
            {row.errorEvents}
          </Badge>
        ),
      },
      {
        key: "lastSeen",
        label: "Last Seen",
        render: (row: TopUserRow) => (
          <span className="text-sm text-neutral-600">
            {row.lastSeen ? formatDate(row.lastSeen) : "-"}
          </span>
        ),
      },
      {
        key: "actions",
        label: "",
        className: "w-24",
        render: (row: TopUserRow) => (
          <Button size="sm" variant="outline" asChild>
            <Link href={`/admin/users/${row.userId}`}>Inspect</Link>
          </Button>
        ),
      },
    ],
    []
  );

  return (
    <div className="space-y-4">
      <LiveRefresh tables={[{ table: "events" }, { table: "users" }]} intervalFallbackMs={3000} />

      <Card>
        <CardContent className="p-4">
          <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
            <Input
              value={searchInput}
              placeholder="Search event text..."
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <Select
              value={eventName}
              onValueChange={(value) => router.push(buildUrl({ event: value, page: "1" }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="All events" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All events</SelectItem>
                {eventOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={scope}
              onValueChange={(value: ActivityScope) =>
                router.push(buildUrl({ scope: value, page: "1" }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All users</SelectItem>
                <SelectItem value="known">Known users only</SelectItem>
                <SelectItem value="anonymous">Anonymous only</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={timeWindow}
              onValueChange={(value: TimeWindow) =>
                router.push(buildUrl({ window: value, page: "1" }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Time window" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Last 1h</SelectItem>
                <SelectItem value="3h">Last 3h</SelectItem>
                <SelectItem value="6h">Last 6h</SelectItem>
                <SelectItem value="12h">Last 12h</SelectItem>
                <SelectItem value="24h">Last 24h</SelectItem>
                <SelectItem value="3d">Last 3d</SelectItem>
                <SelectItem value="7d">Last 7d</SelectItem>
                <SelectItem value="14d">Last 14d</SelectItem>
                <SelectItem value="30d">Last 30d</SelectItem>
                <SelectItem value="90d">Last 90d</SelectItem>
                <SelectItem value="180d">Last 6m</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={chartType}
              onValueChange={(value: ChartType) =>
                router.push(buildUrl({ chart: value, page: "1" }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Chart type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bars">Bar chart</SelectItem>
                <SelectItem value="line">Line chart</SelectItem>
                <SelectItem value="area">Area chart</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Input
                value={userInput}
                placeholder="Search user email/name/id..."
                disabled={scope === "anonymous"}
                onChange={(e) => setUserInput(e.target.value)}
              />
              <Button
                variant="outline"
                onClick={() => {
                  setSearchInput("");
                  setUserInput("");
                  router.push(
                    `${pathname}?${new URLSearchParams({
                      page: "1",
                      search: "",
                      event: "all",
                      scope: "all",
                      window: "7d",
                      chart: "bars",
                      user: "",
                    }).toString()}`
                  );
                }}
              >
                Reset
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Events</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{monitoringSummary.totalEvents}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Known / Anonymous</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {monitoringSummary.knownEvents} / {monitoringSummary.anonymousEvents}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Active Now</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{monitoringSummary.activeNowUsers}</p>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              <p className="text-xs text-neutral-500">Online users (session presence, live)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Unique Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{monitoringSummary.uniqueSessions}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Avg Events / User</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {monitoringSummary.avgEventsPerUser.toFixed(2)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Error-like Events</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-red-600">
              {monitoringSummary.errorEvents}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Peak Activity Bucket</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-semibold">{monitoringSummary.peakLabel}</p>
            <p className="text-xs text-neutral-500">{monitoringSummary.peakCount} events</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Analytics Coverage</CardTitle>
          </CardHeader>
          <CardContent>
            {monitoringSummary.sampled ? (
              <div className="space-y-1">
                <Badge variant="warning">Sampled</Badge>
                <p className="text-xs text-neutral-500">
                  {monitoringSummary.sampledRows} of {monitoringSummary.sampleFromTotal} events
                </p>
              </div>
            ) : (
              <Badge variant="success">Full Coverage</Badge>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Activity Trend</CardTitle>
        </CardHeader>
        <CardContent>
          {!trend.length ? (
            <div className="py-8 text-sm text-neutral-400">No data for trend.</div>
          ) : (
            <div className="space-y-3">
              <div className="relative rounded-md border border-neutral-200 bg-white p-2">
                {activeTrendPoint ? (
                  <div className="pointer-events-none absolute top-3 right-3 z-10 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs shadow-sm">
                    <p className="font-medium text-neutral-900">{activeTrendPoint.label}</p>
                    <p className="text-neutral-600">{activeTrendPoint.count} events</p>
                  </div>
                ) : null}
                <svg
                  viewBox={`0 0 ${trendGeometry.width} ${trendGeometry.height}`}
                  className="h-56 w-full"
                  role="img"
                  aria-label="Activity trend chart"
                  onMouseLeave={() => setActiveTrendIndex(null)}
                >
                  {[0, 1, 2, 3, 4].map((step) => {
                    const y = trendGeometry.baselineY - (step / 4) * (trendGeometry.baselineY - 14);
                    const value = Math.round((step / 4) * trendGeometry.maxValue);
                    return (
                      <g key={step}>
                        <line
                          x1={18}
                          x2={trendGeometry.width - 18}
                          y1={y}
                          y2={y}
                          stroke="#e5e7eb"
                          strokeWidth={1}
                        />
                        <text x={4} y={y + 3} fontSize="10" fill="#737373">
                          {value}
                        </text>
                      </g>
                    );
                  })}

                  {activeTrendPoint ? (
                    <line
                      x1={activeTrendPoint.x}
                      x2={activeTrendPoint.x}
                      y1={14}
                      y2={trendGeometry.baselineY}
                      stroke="#93c5fd"
                      strokeWidth={1}
                      strokeDasharray="4 4"
                    />
                  ) : null}

                  {chartType === "bars" &&
                    trendGeometry.points.map((point, index) => {
                      const barHeight = Math.max(2, trendGeometry.baselineY - point.y);
                      return (
                        <rect
                          key={point.id}
                          x={point.x - trendGeometry.barWidth / 2}
                          y={trendGeometry.baselineY - barHeight}
                          width={trendGeometry.barWidth}
                          height={barHeight}
                          rx={1.5}
                          fill={activeTrendIndex === index ? "#1d4ed8" : "#2563eb"}
                        >
                          <title>{`${point.label}: ${point.count}`}</title>
                        </rect>
                      );
                    })}

                  {(chartType === "line" || chartType === "area") && (
                    <>
                      {chartType === "area" && trendGeometry.areaPath ? (
                        <path d={trendGeometry.areaPath} fill="#60a5fa55" stroke="none" />
                      ) : null}
                      {trendGeometry.linePath ? (
                        <path
                          d={trendGeometry.linePath}
                          fill="none"
                          stroke="#2563eb"
                          strokeWidth={2}
                          strokeLinejoin="round"
                          strokeLinecap="round"
                        />
                      ) : null}
                      {showPointMarkers &&
                        trendGeometry.points.map((point, index) => (
                          <circle
                            key={point.id}
                            cx={point.x}
                            cy={point.y}
                            r={activeTrendIndex === index ? 4 : 2.5}
                            fill="#2563eb"
                          >
                            <title>{`${point.label}: ${point.count}`}</title>
                          </circle>
                        ))}
                    </>
                  )}

                  {trendGeometry.points.map((point, index) => {
                    const previousX = trendGeometry.points[index - 1]?.x ?? 18;
                    const nextX =
                      trendGeometry.points[index + 1]?.x ?? trendGeometry.width - 18;
                    const startX = index === 0 ? 18 : (previousX + point.x) / 2;
                    const endX =
                      index === trendGeometry.points.length - 1
                        ? trendGeometry.width - 18
                        : (point.x + nextX) / 2;
                    const hitWidth = Math.max(1, endX - startX);
                    return (
                      <rect
                        key={`hit-${point.id}`}
                        x={startX}
                        y={14}
                        width={hitWidth}
                        height={trendGeometry.baselineY - 14}
                        fill="transparent"
                        onMouseEnter={() => setActiveTrendIndex(index)}
                      />
                    );
                  })}
                </svg>
              </div>
              <div className="flex items-center justify-between text-[10px] text-neutral-500">
                {xAxisIndices.map((index) => (
                  <span key={trend[index].id}>{trend[index].shortLabel}</span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Top Events</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!topEvents.length ? (
              <div className="px-4 py-8 text-sm text-neutral-400">No event distribution data.</div>
            ) : (
              <div className="divide-y divide-neutral-100">
                {topEvents.map((item) => (
                  <div key={item.id} className="flex items-center justify-between px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-neutral-900">
                        {item.eventName}
                      </p>
                      <p className="text-xs text-neutral-500">{item.share.toFixed(1)}%</p>
                    </div>
                    <Badge variant="secondary">{item.count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Top Event Transitions</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!topTransitions.length ? (
              <div className="px-4 py-8 text-sm text-neutral-400">No transition pattern yet.</div>
            ) : (
              <div className="divide-y divide-neutral-100">
                {topTransitions.map((item) => (
                  <div key={item.id} className="flex items-center justify-between px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-neutral-900">
                        {item.from} {"->"} {item.to}
                      </p>
                    </div>
                    <Badge variant="info">{item.count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-neutral-900">User Monitoring</h2>
        <DataTable
          columns={topUserColumns}
          data={topUsers}
          emptyMessage="No user monitoring data."
        />
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-neutral-900">Live Event Stream</h2>
        <DataTable
          columns={feedColumns}
          data={feedRows}
          emptyMessage="No events found for the selected filters."
        />
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        onPageChange={(p) => router.push(buildUrl({ page: String(p) }))}
        count={count}
        pageSize={pageSize}
      />
    </div>
  );
}
