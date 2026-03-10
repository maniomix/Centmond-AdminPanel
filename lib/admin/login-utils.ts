export function normalizeAdminIdentifier(identifier: string): string {
  return identifier.trim().toLowerCase();
}

export function isRateLimitExceeded(
  identifierFailures: number,
  ipFailures: number,
  maxAttempts: number
): boolean {
  return identifierFailures >= maxAttempts || ipFailures >= maxAttempts;
}
