import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

interface UserSessionView {
  id: string;
  sessionId: string | null;
  device: string;
  lastSeenAt: string;
  firstSeenAt: string;
  eventCount: number;
  recentEvent: string;
}

interface UserSecurityPanelProps {
  sessions: UserSessionView[];
}

export function UserSecurityPanel({ sessions }: UserSecurityPanelProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Sessions & Devices</CardTitle>
        <CardDescription>
          Device and session activity inferred from recent product events.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {!sessions.length ? (
          <div className="px-6 py-8 text-center text-sm text-neutral-400">
            No session or device signal detected.
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {sessions.map((session) => (
              <div key={session.id} className="px-6 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-neutral-900">{session.device}</p>
                    <Badge variant="secondary">{session.eventCount} events</Badge>
                  </div>
                  <p className="text-xs text-neutral-500">{formatDate(session.lastSeenAt)}</p>
                </div>
                <p className="mt-1 text-xs text-neutral-500">
                  First seen {formatDate(session.firstSeenAt)}
                  {session.sessionId ? ` • Session ${session.sessionId}` : ""}
                </p>
                <p className="mt-2 text-sm text-neutral-600">Recent signal: {session.recentEvent}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
