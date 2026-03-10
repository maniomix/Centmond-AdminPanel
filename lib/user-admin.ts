import type { Json, SubscriptionRow, UserRow } from "@/types/database";

function tryParseSerializedJson(value: string): Json | string | null {
  const normalized = value.trim();
  if (!normalized) return null;

  const shouldParse =
    normalized.startsWith("[") ||
    normalized.startsWith("{") ||
    normalized.startsWith('"') ||
    normalized === "null";

  if (!shouldParse) return normalized;

  try {
    return JSON.parse(normalized) as Json;
  } catch {
    return normalized;
  }
}

function appendStringValue(
  value: Json | string | undefined,
  collected: string[],
  seen: Set<string>
) {
  if (typeof value === "string") {
    const parsed = tryParseSerializedJson(value);
    if (parsed !== value) {
      if (parsed !== null) {
        appendStringValue(parsed, collected, seen);
      }
      return;
    }

    const normalized = value.trim();
    if (
      !normalized ||
      normalized === "[]" ||
      normalized === "{}" ||
      normalized === "null" ||
      normalized === '""'
    ) {
      return;
    }

    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      collected.push(normalized);
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      appendStringValue(entry, collected, seen);
    }
    return;
  }

  if (value && typeof value === "object") {
    for (const entry of Object.values(value)) {
      if (entry !== undefined) {
        appendStringValue(entry, collected, seen);
      }
    }
  }
}

export function extractUserCategories(value: UserRow["custom_categories"]): string[] {
  const collected: string[] = [];
  const seen = new Set<string>();
  appendStringValue(value ?? undefined, collected, seen);
  return collected;
}

export function stringifyUserCategories(value: UserRow["custom_categories"]): string {
  return extractUserCategories(value).join("\n");
}

export function parseAdminCategoryInput(input: string): Json | string | null {
  const normalized = input.trim();
  if (!normalized) return null;

  const parsed = tryParseSerializedJson(normalized);
  if (parsed !== normalized) {
    return parsed;
  }

  const values = normalized
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (!values.length) return null;
  if (values.length === 1) return values[0];
  return values;
}

export function summarizeJson(
  value: Json | string | null | undefined,
  maxLength = 140
): string {
  if (value === null || value === undefined) return "-";
  const raw = typeof value === "string" ? value : JSON.stringify(value);
  if (raw.length <= maxLength) return raw;
  return `${raw.slice(0, maxLength)}...`;
}

export function getSubscriptionBadgeVariant(
  status: string | null | undefined
): "success" | "warning" | "secondary" | "destructive" {
  switch ((status ?? "").toLowerCase()) {
    case "active":
      return "success";
    case "trialing":
      return "warning";
    case "cancelled":
    case "expired":
    case "past_due":
      return "destructive";
    default:
      return "secondary";
  }
}

export function hasElevatedAccess(
  subscription: Pick<SubscriptionRow, "status" | "plan"> | null | undefined
): boolean {
  if (!subscription) return false;
  const activeLike = ["active", "trialing"];
  return (
    activeLike.includes((subscription.status ?? "").toLowerCase()) &&
    (subscription.plan ?? "").toLowerCase() !== "free"
  );
}
