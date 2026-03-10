export interface UserEventTimestampRow {
  user_id: string | null;
  created_at: string;
}

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
