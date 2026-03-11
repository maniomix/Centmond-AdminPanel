function normalizeTableName(tableName: string): string {
  return tableName.toLowerCase().replace(/^public\./, "").replace(/"/g, "").trim();
}

export function isMissingTableError(message: string, tableName: string): boolean {
  const normalizedMessage = message.toLowerCase();
  const normalizedTableName = normalizeTableName(tableName);

  return (
    normalizedMessage.includes(normalizedTableName) &&
    (normalizedMessage.includes("schema cache") ||
      normalizedMessage.includes("does not exist") ||
      normalizedMessage.includes("relation"))
  );
}
