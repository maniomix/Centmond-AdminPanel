import { parsePage } from "@/lib/table-params";
import { requirePermission } from "@/lib/admin/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { ReviewQueueTable } from "@/components/admin/reviews/review-queue-table";
import { listReviewQueueData } from "@/lib/admin/services/reviews";

export const revalidate = 0;

type QueueFilter = "all" | "under_review" | "escalated" | "restricted" | "resolved";

function parseQueue(value: string | undefined): QueueFilter {
  if (
    value === "under_review" ||
    value === "escalated" ||
    value === "restricted" ||
    value === "resolved"
  ) {
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
  const allRows = (await listReviewQueueData())
    .filter((item) => {
      if (queue === "all") return true;
      return item.status === queue;
    })
    .map((item) => ({
      queueId: item.id,
      id: item.user.id,
      display_name: item.user.display_name?.trim() || "Unnamed User",
      email: item.user.email,
      userStatus: item.user.status,
      queueStatus: item.status,
      priority: item.priority,
      risk_score: item.user.risk_score,
      risk_status: item.user.risk_status,
      activeFlags: item.activeFlags,
      last_active_at: item.user.last_active_at,
      created_at: item.user.created_at,
      latestReason: item.latest_reason,
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
  const underReviewCount = allRows.filter((user) => user.queueStatus === "under_review").length;
  const escalatedCount = allRows.filter((user) => user.queueStatus === "escalated").length;
  const restrictedCount = allRows.filter((user) => user.queueStatus === "restricted").length;

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
            <p className="text-xs uppercase tracking-wide text-neutral-500">Escalated</p>
            <p className="mt-2 text-2xl font-semibold text-neutral-900">{escalatedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Restricted</p>
            <p className="mt-2 text-2xl font-semibold text-neutral-900">{restrictedCount}</p>
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
