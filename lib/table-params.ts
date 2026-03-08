export function parsePage(value: string | undefined, fallback = 1): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return parsed;
}

export function parseSortOrder(value: string | undefined): "asc" | "desc" {
  return value === "asc" ? "asc" : "desc";
}

export function parseSortBy<T extends readonly string[]>(
  value: string | undefined,
  allowed: T,
  fallback: T[number]
): T[number] {
  if (value && (allowed as readonly string[]).includes(value)) {
    return value;
  }
  return fallback;
}
