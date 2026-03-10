export interface UserEventTimestampRow {
  user_id: string | null;
  created_at: string;
}

export interface UserPresenceEventRow extends UserEventTimestampRow {
  event_name: string;
  session_id?: string | null;
}

export const USER_ONLINE_SESSION_EVENTS = [
  "session_start",
  "app_open",
  "session_resume",
] as const;

export const USER_OFFLINE_SESSION_EVENTS = [
  "session_end",
  "app_background",
  "app_closed",
] as const;

export const USER_SESSION_STATE_EVENTS = [
  ...USER_ONLINE_SESSION_EVENTS,
  ...USER_OFFLINE_SESSION_EVENTS,
] as const;

export function pickLatestIsoTimestamp(
  ...values: Array<string | null | undefined>
): string | null {
  let latestValue: string | null = null;
  let latestTs = Number.NEGATIVE_INFINITY;

  for (const value of values) {
    if (!value) continue;
    const ts = Date.parse(value);
    if (Number.isNaN(ts)) continue;
    if (ts > latestTs) {
      latestTs = ts;
      latestValue = value;
    }
  }

  return latestValue;
}

export function buildLatestEventByUserMap(
  rows: UserEventTimestampRow[]
): Map<string, string> {
  const latestByUser = new Map<string, string>();

  for (const row of rows) {
    if (!row.user_id) continue;
    const current = latestByUser.get(row.user_id);
    const latest = pickLatestIsoTimestamp(current, row.created_at);
    if (latest) {
      latestByUser.set(row.user_id, latest);
    }
  }

  return latestByUser;
}

function buildPresenceSessionKey(row: UserPresenceEventRow): string | null {
  if (!row.user_id) return null;
  if (row.session_id) return `session:${row.session_id}`;
  if ((USER_SESSION_STATE_EVENTS as readonly string[]).includes(row.event_name)) {
    return `user:${row.user_id}`;
  }
  return null;
}

export function buildOnlineUserIds(input: {
  sessionStateRows: UserPresenceEventRow[];
  recentEventRows: UserPresenceEventRow[];
  recentWindowSeconds: number;
  nowMs?: number;
}): string[] {
  const nowMs = input.nowMs ?? Date.now();
  const recentCutoffMs = nowMs - input.recentWindowSeconds * 1000;
  const latestStateBySession = new Map<string, UserPresenceEventRow>();

  for (const row of input.sessionStateRows) {
    if (!row.user_id) continue;
    const sessionKey = buildPresenceSessionKey(row);
    if (!sessionKey) continue;

    const existing = latestStateBySession.get(sessionKey);
    const existingTs = existing ? Date.parse(existing.created_at) : Number.NEGATIVE_INFINITY;
    const nextTs = Date.parse(row.created_at);
    if (!Number.isNaN(nextTs) && nextTs >= existingTs) {
      latestStateBySession.set(sessionKey, row);
    }
  }

  const closedSessionKeys = new Set(
    Array.from(latestStateBySession.entries())
      .filter(([, row]) =>
        (USER_OFFLINE_SESSION_EVENTS as readonly string[]).includes(row.event_name)
      )
      .map(([sessionKey]) => sessionKey)
  );

  const onlineUserIds = new Set<string>();

  for (const row of latestStateBySession.values()) {
    if (!row.user_id) continue;
    const createdAtMs = Date.parse(row.created_at);
    if (Number.isNaN(createdAtMs) || createdAtMs < recentCutoffMs) continue;
    if ((USER_ONLINE_SESSION_EVENTS as readonly string[]).includes(row.event_name)) {
      onlineUserIds.add(row.user_id);
    }
  }

  for (const row of input.recentEventRows) {
    if (!row.user_id) continue;
    const createdAtMs = Date.parse(row.created_at);
    if (Number.isNaN(createdAtMs) || createdAtMs < recentCutoffMs) continue;
    if ((USER_OFFLINE_SESSION_EVENTS as readonly string[]).includes(row.event_name)) {
      continue;
    }

    const sessionKey = buildPresenceSessionKey(row);
    if (sessionKey && closedSessionKeys.has(sessionKey)) {
      continue;
    }

    if (row.session_id) {
      onlineUserIds.add(row.user_id);
      continue;
    }

    if ((USER_ONLINE_SESSION_EVENTS as readonly string[]).includes(row.event_name)) {
      onlineUserIds.add(row.user_id);
    }
  }

  return Array.from(onlineUserIds);
}
