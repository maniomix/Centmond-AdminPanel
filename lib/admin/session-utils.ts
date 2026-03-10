export function hasRecentSensitiveAuthTimestamp(
  timestamp: string | null | undefined,
  windowMinutes: number
): boolean {
  if (!timestamp) return false;
  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed)) return false;
  return Date.now() - parsed <= windowMinutes * 60 * 1000;
}
