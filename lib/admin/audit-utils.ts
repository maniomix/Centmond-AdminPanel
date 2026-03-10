export function isMissingAuditTableError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("admin_audit_logs") &&
    (normalized.includes("schema cache") ||
      normalized.includes("does not exist") ||
      normalized.includes("relation"))
  );
}

export function classifyAuditWriteFailure(
  message: string,
  options?: { required?: boolean }
): "throw" | "skip" | "warn" {
  if (options?.required) {
    return "throw";
  }
  if (isMissingAuditTableError(message)) {
    return "skip";
  }
  return "warn";
}
