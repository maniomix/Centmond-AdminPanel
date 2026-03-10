import { createAdminClient } from "@/lib/supabase/admin";
import { parsePage, parseSortBy, parseSortOrder } from "@/lib/table-params";
import { fromStoredMoney } from "@/lib/money";
import { PageHeader } from "@/components/shared/page-header";
import { SegmentsClient } from "./segments-client";
import { hasPermission, requirePermission } from "@/lib/admin/permissions";

export const revalidate = 0;

const INACTIVE_DAYS_THRESHOLD = 14;
const HIGH_SPEND_EUR_THRESHOLD = 500;

type SegmentKey =
  | "all"
  | "paid_active"
  | "trial_ending_7d"
  | "inactive_paid_14d"
  | "unverified_users"
  | "high_spend_30d"
  | "no_subscription";

interface SegmentDefinition {
  key: Exclude<SegmentKey, "all">;
  label: string;
  description: string;
}

interface SegmentTableRow {
  id: string;
  display_name: string;
  email: string;
  is_email_verified: boolean;
  plan: string;
  subscription_status: string;
  last_active_at: string | null;
  created_at: string;
  trial_end: string | null;
  current_period_end: string | null;
  income30d: number;
  expense30d: number;
  net30d: number;
}

interface SegmentOption {
  key: SegmentKey;
  label: string;
  description: string;
  count: number;
}

const SEGMENTS: SegmentDefinition[] = [
  {
    key: "paid_active",
    label: "Paid Active",
    description: "Users with non-free plan and active subscription status.",
  },
  {
    key: "trial_ending_7d",
    label: "Trial Ending 7d",
    description: "Users whose trial ends within the next 7 days.",
  },
  {
    key: "inactive_paid_14d",
    label: "Inactive Paid 14d",
    description: "Paid users inactive for 14+ days.",
  },
  {
    key: "unverified_users",
    label: "Unverified Users",
    description: "Users that have not verified email.",
  },
  {
    key: "high_spend_30d",
    label: "High Spend 30d",
    description: `Users with expense >= ${HIGH_SPEND_EUR_THRESHOLD} EUR in 30 days.`,
  },
  {
    key: "no_subscription",
    label: "No Subscription",
    description: "Users with no subscription record.",
  },
];

const SORT_COLUMNS = [
  "display_name",
  "email",
  "plan",
  "last_active_at",
  "expense30d",
  "net30d",
  "created_at",
] as const;

function getThirtyDaysAgoDateString(): string {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

function parseSegment(value: string | undefined): SegmentKey {
  if (!value) return "all";
  if (value === "all") return "all";
  return SEGMENTS.some((segment) => segment.key === value)
    ? (value as SegmentKey)
    : "all";
}

function isBetweenNowAndDays(value: string | null, days: number): boolean {
  if (!value) return false;
  const ts = Date.parse(value);
  if (Number.isNaN(ts)) return false;
  const now = Date.now();
  const max = now + days * 24 * 60 * 60 * 1000;
  return ts >= now && ts <= max;
}

function isInactiveDays(value: string | null, days: number): boolean {
  if (!value) return true;
  const ts = Date.parse(value);
  if (Number.isNaN(ts)) return true;
  return Date.now() - ts >= days * 24 * 60 * 60 * 1000;
}

function isPaid(plan: string, status: string): boolean {
  return plan !== "free" && status !== "free";
}

function matchSegment(row: SegmentTableRow, key: SegmentKey): boolean {
  if (key === "all") return true;
  if (key === "paid_active") return isPaid(row.plan, row.subscription_status);
  if (key === "trial_ending_7d") return isBetweenNowAndDays(row.trial_end, 7);
  if (key === "inactive_paid_14d") {
    return isPaid(row.plan, row.subscription_status) && isInactiveDays(row.last_active_at, INACTIVE_DAYS_THRESHOLD);
  }
  if (key === "unverified_users") return !row.is_email_verified;
  if (key === "high_spend_30d") return row.expense30d >= HIGH_SPEND_EUR_THRESHOLD;
  if (key === "no_subscription") return row.plan === "none";
  return false;
}

function compareNullable<T extends number | string>(
  a: T | null,
  b: T | null,
  sortOrder: "asc" | "desc"
): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const base = a < b ? -1 : a > b ? 1 : 0;
  return sortOrder === "asc" ? base : -base;
}

function parseSavedViewFilters(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>).filter(
    ([, entry]) => typeof entry === "string"
  );
  return Object.fromEntries(entries) as Record<string, string>;
}

export default async function SegmentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    search?: string;
    segment?: string;
    sortBy?: string;
    sortOrder?: string;
  }>;
}) {
  const adminContext = await requirePermission("users.view");
  const params = await searchParams;
  const page = parsePage(params.page);
  const pageSize = 20;
  const search = params.search?.trim() ?? "";
  const segment = parseSegment(params.segment);
  const sortBy = parseSortBy(params.sortBy, SORT_COLUMNS, "expense30d");
  const sortOrder = parseSortOrder(params.sortOrder);

  const supabase = createAdminClient();
  const thirtyDaysAgo = getThirtyDaysAgoDateString();

  const [{ data: users }, { data: subscriptions }, { data: transactions }] =
    await Promise.all([
      supabase
        .from("users")
        .select("id, email, display_name, is_email_verified, created_at, last_active_at"),
      supabase
        .from("subscriptions")
        .select("user_id, plan, status, trial_end, current_period_end, updated_at")
        .order("updated_at", { ascending: false }),
      supabase
        .from("transactions")
        .select("user_id, amount, type")
        .eq("is_deleted", false)
        .gte("date", thirtyDaysAgo),
    ]);

  const latestSubscriptionByUser = new Map<
    string,
    {
      plan: string;
      status: string;
      trial_end: string | null;
      current_period_end: string | null;
      updated_at: string;
    }
  >();

  for (const subscription of subscriptions ?? []) {
    if (!latestSubscriptionByUser.has(subscription.user_id)) {
      latestSubscriptionByUser.set(subscription.user_id, subscription);
    }
  }

  const txByUser = new Map<string, { income: number; expense: number }>();
  for (const tx of transactions ?? []) {
    const current = txByUser.get(tx.user_id) ?? { income: 0, expense: 0 };
    const amount = fromStoredMoney(Number(tx.amount ?? 0));
    if (tx.type === "income") current.income += amount;
    else current.expense += amount;
    txByUser.set(tx.user_id, current);
  }

  const allRows: SegmentTableRow[] = (users ?? []).map((user) => {
    const subscription = latestSubscriptionByUser.get(user.id);
    const tx = txByUser.get(user.id) ?? { income: 0, expense: 0 };
    return {
      id: user.id,
      display_name: (user.display_name ?? "Unnamed").trim(),
      email: user.email,
      is_email_verified: user.is_email_verified,
      plan: subscription?.plan ?? "none",
      subscription_status: subscription?.status ?? "none",
      last_active_at: user.last_active_at,
      created_at: user.created_at,
      trial_end: subscription?.trial_end ?? null,
      current_period_end: subscription?.current_period_end ?? null,
      income30d: tx.income,
      expense30d: tx.expense,
      net30d: tx.income - tx.expense,
    };
  });

  const options: SegmentOption[] = [
    {
      key: "all",
      label: "All Users",
      description: "All users in the workspace.",
      count: allRows.length,
    },
    ...SEGMENTS.map((segmentDef) => ({
      key: segmentDef.key,
      label: segmentDef.label,
      description: segmentDef.description,
      count: allRows.filter((row) => matchSegment(row, segmentDef.key)).length,
    })),
  ];

  const normalizedSearch = search.toLowerCase();
  let filtered = allRows.filter((row) => matchSegment(row, segment));

  if (normalizedSearch) {
    filtered = filtered.filter((row) => {
      const name = row.display_name.toLowerCase();
      const email = row.email.toLowerCase();
      return name.includes(normalizedSearch) || email.includes(normalizedSearch);
    });
  }

  filtered.sort((a, b) => {
    if (sortBy === "expense30d") {
      return compareNullable(a.expense30d, b.expense30d, sortOrder);
    }
    if (sortBy === "net30d") {
      return compareNullable(a.net30d, b.net30d, sortOrder);
    }
    if (sortBy === "last_active_at") {
      const aTs = a.last_active_at ? Date.parse(a.last_active_at) : null;
      const bTs = b.last_active_at ? Date.parse(b.last_active_at) : null;
      return compareNullable(aTs, bTs, sortOrder);
    }
    if (sortBy === "created_at") {
      const aTs = Date.parse(a.created_at);
      const bTs = Date.parse(b.created_at);
      return compareNullable(aTs, bTs, sortOrder);
    }
    if (sortBy === "plan") {
      return compareNullable(a.plan.toLowerCase(), b.plan.toLowerCase(), sortOrder);
    }
    if (sortBy === "email") {
      return compareNullable(a.email.toLowerCase(), b.email.toLowerCase(), sortOrder);
    }
    return compareNullable(
      a.display_name.toLowerCase(),
      b.display_name.toLowerCase(),
      sortOrder
    );
  });

  const count = filtered.length;
  const start = (page - 1) * pageSize;
  const rows = filtered.slice(start, start + pageSize);

  const { data: savedViews } = hasPermission(adminContext, "saved_views.manage")
    ? await supabase
        .from("saved_views")
        .select("id, name, description, filters, is_shared, created_at, updated_at")
        .eq("scope", "users")
        .or(`owner_admin_id.eq.${adminContext.id},is_shared.eq.true`)
        .order("updated_at", { ascending: false })
        .limit(20)
    : { data: [] };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Segments"
        description="Predefined user segments for retention, billing and lifecycle operations."
      />
      <SegmentsClient
        rows={rows}
        count={count}
        page={page}
        pageSize={pageSize}
        search={search}
        segment={segment}
        sortBy={sortBy}
        sortOrder={sortOrder}
        options={options}
        savedViews={(savedViews ?? []).map((view) => ({
          id: view.id,
          name: view.name,
          description: view.description,
          filters: parseSavedViewFilters(view.filters),
          is_shared: view.is_shared,
        }))}
        canManageSavedViews={hasPermission(adminContext, "saved_views.manage")}
      />
    </div>
  );
}
