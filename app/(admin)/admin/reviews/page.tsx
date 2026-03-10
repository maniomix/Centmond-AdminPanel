import { createAdminClient } from "@/lib/supabase/admin";
import { parsePage } from "@/lib/table-params";
import { requirePermission } from "@/lib/admin/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { ReviewQueueTable } from "@/components/admin/reviews/review-queue-table";

export const revalidate = 0;

type QueueFilter = "all" | "under_review" | "flagged" | "high_risk";

function parseQueue(value: string | undefined): QueueFilter {
  if (value === "under_review" || value === "flagged" || value === "high_risk") {
    return value;
  }
  return "all";
}

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; queue?: string }>;
}) {
  await requirePermission("reviews.manage");
  const params = await searchParams;
  const page = parsePage(params.page);
  const pageSize = 20;
  const search = params.search?.trim().toLowerCase() ?? "";
  const queue = parseQueue(params.queue);
  const supabase = createAdminClient();

  const [{ data: users }, { data: flags }, { data: flagAssignments }] = await Promise.all([
    supabase
      .from("users")
      .select("id, email, display_name, status, risk_score, risk_status, last_active_at, created_at"),
    supabase.from("user_flags").select("id, label"),
    supabase
      .from("user_flag_assignments")
      .select("user_id, flag_id, status")
      .eq("status", "active"),
  ]);

  const flagLabelsById = new Map((flags ?? []).map((flag) => [flag.id, flag.label]));
  const activeFlagsByUserId = new Map<string, string[]>();
  for (const assignment of flagAssignments ?? []) {
    const label = flagLabelsById.get(assignment.flag_id);
    if (!label) continue;
    const current = activeFlagsByUserId.get(assignment.user_id) ?? [];
    current.push(label);
    activeFlagsByUserId.set(assignment.user_id, current);
  }

  const allRows = (users ?? [])
    .filter((user) => {
      if (queue === "under_review") return user.status === "under_review";
      if (queue === "flagged") return user.status === "flagged" || user.status === "banned";
      if (queue === "high_risk") {
        return (user.risk_score ?? 0) >= 70 || (activeFlagsByUserId.get(user.id)?.length ?? 0) > 0;
      }
      return (
        user.status === "under_review" ||
        user.status === "flagged" ||
        user.status === "banned" ||
        (user.risk_score ?? 0) >= 70 ||
        (activeFlagsByUserId.get(user.id)?.length ?? 0) > 0
      );
    })
    .map((user) => ({
      ...user,
      display_name: user.display_name?.trim() || "Unnamed User",
      activeFlags: activeFlagsByUserId.get(user.id) ?? [],
    }))
    .filter((user) => {
      if (!search) return true;
      return (
        user.display_name.toLowerCase().includes(search) ||
        user.email.toLowerCase().includes(search)
      );
    })
    .sort((a, b) => {
      const riskGap = (b.risk_score ?? 0) - (a.risk_score ?? 0);
      if (riskGap !== 0) return riskGap;
      return (Date.parse(b.last_active_at ?? b.created_at) || 0) - (Date.parse(a.last_active_at ?? a.created_at) || 0);
    });

  const pagedRows = allRows.slice((page - 1) * pageSize, page * pageSize);
  const underReviewCount = allRows.filter((user) => user.status === "under_review").length;
  const flaggedCount = allRows.filter(
    (user) => user.status === "flagged" || user.status === "banned"
  ).length;
  const highRiskCount = allRows.filter(
    (user) => (user.risk_score ?? 0) >= 70 || user.activeFlags.length > 0
  ).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Review Queue"
        description="Operational queue for users requiring trust, fraud, or moderation review."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Under Review</p>
            <p className="mt-2 text-2xl font-semibold text-neutral-900">{underReviewCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Flagged / Banned</p>
            <p className="mt-2 text-2xl font-semibold text-neutral-900">{flaggedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-neutral-500">High Risk Signals</p>
            <p className="mt-2 text-2xl font-semibold text-neutral-900">{highRiskCount}</p>
          </CardContent>
        </Card>
      </div>

      <ReviewQueueTable
        rows={pagedRows}
        count={allRows.length}
        page={page}
        pageSize={pageSize}
        search={params.search?.trim() ?? ""}
        queue={queue}
      />
    </div>
  );
}
