import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatEuroAmount } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { getFinanceOverview } from "@/lib/admin/services/finance";
import { hasPermission, requireAnyPermission } from "@/lib/admin/permissions";
import { FinanceEventForm } from "./finance-event-form";

export const revalidate = 0;

export default async function FinancePage() {
  const adminContext = await requireAnyPermission(["finance.manage", "billing.view"]);
  const overview = await getFinanceOverview();
  const canManageFinance = hasPermission(adminContext, "finance.manage");

  return (
    <div className="space-y-5">
      <PageHeader
        title="Finance"
        description="Operator-facing billing visibility, refund records, and internal finance workflow notes."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Active paid subs</p>
            <p className="mt-2 text-2xl font-semibold text-neutral-900">
              {overview.metrics.activePaidSubscriptions}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Past due</p>
            <p className="mt-2 text-2xl font-semibold text-neutral-900">
              {overview.metrics.pastDueSubscriptions}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Refund records 30d</p>
            <p className="mt-2 text-2xl font-semibold text-neutral-900">
              {overview.metrics.refundsRecorded30d}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Net revenue 30d</p>
            <p className="mt-2 text-2xl font-semibold text-neutral-900">
              {formatEuroAmount(overview.metrics.netRevenue30d)} €
            </p>
          </CardContent>
        </Card>
      </div>

      {canManageFinance ? <FinanceEventForm /> : null}

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent Finance Events</CardTitle>
            <CardDescription>Internal ledger of finance-side admin actions and recorded exceptions.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {!overview.financeEvents.length ? (
              <div className="px-6 py-8 text-sm text-neutral-400">No finance events recorded yet.</div>
            ) : (
              <div className="divide-y divide-neutral-100">
                {overview.financeEvents.map((event) => (
                  <div key={event.id} className="px-6 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-neutral-900">{event.event_type}</p>
                        <Badge variant={event.status === "recorded" ? "secondary" : "warning"}>
                          {event.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <p className="text-xs text-neutral-500">{formatDate(event.created_at)}</p>
                    </div>
                    <p className="mt-1 text-sm text-neutral-600">
                      {event.reason}
                      {event.amount ? ` • ${formatEuroAmount(event.amount)} ${event.currency}` : ""}
                    </p>
                    {event.note ? <p className="mt-1 text-xs text-neutral-500">{event.note}</p> : null}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Finance Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!overview.financeNotes.length ? (
                <p className="text-sm text-neutral-400">No finance notes yet.</p>
              ) : (
                overview.financeNotes.map((note) => (
                  <div key={note.id} className="rounded-lg border border-neutral-200 p-3">
                    <p className="text-sm text-neutral-700">{note.body}</p>
                    <p className="mt-2 text-xs text-neutral-500">{formatDate(note.created_at)}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Subscription Watchlist</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!overview.subscriptions.length ? (
                <p className="text-sm text-neutral-400">No subscriptions available.</p>
              ) : (
                overview.subscriptions.map((subscription) => (
                  <div key={subscription.id} className="rounded-lg border border-neutral-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-neutral-900 capitalize">
                        {subscription.plan}
                      </p>
                      <Badge variant={subscription.status === "past_due" ? "warning" : "secondary"}>
                        {subscription.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-neutral-500">
                      {subscription.platform ?? "Unknown platform"} • User {subscription.user_id}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
