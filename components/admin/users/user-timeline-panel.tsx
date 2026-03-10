import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

interface TimelineItem {
  id: string;
  category: "admin" | "event" | "note" | "billing" | "subscription";
  title: string;
  description: string;
  createdAt: string;
}

interface UserTimelinePanelProps {
  items: TimelineItem[];
}

const categoryVariant: Record<
  TimelineItem["category"],
  "secondary" | "info" | "warning" | "default"
> = {
  admin: "default",
  event: "info",
  note: "secondary",
  billing: "warning",
  subscription: "secondary",
};

export function UserTimelinePanel({ items }: UserTimelinePanelProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Timeline</CardTitle>
        <CardDescription>
          Unified chronology of product events, billing actions, notes, and admin interventions.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {!items.length ? (
          <div className="px-6 py-8 text-center text-sm text-neutral-400">
            No timeline events available.
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {items.map((item) => (
              <div key={item.id} className="px-6 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-neutral-900">{item.title}</p>
                    <Badge variant={categoryVariant[item.category]} className="capitalize">
                      {item.category}
                    </Badge>
                  </div>
                  <p className="text-xs text-neutral-500">{formatDate(item.createdAt)}</p>
                </div>
                <p className="mt-2 text-sm text-neutral-600">{item.description}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
