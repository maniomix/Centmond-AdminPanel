import { BlockList, isIP } from "node:net";

function normalizeIp(value: string): string {
  const trimmed = value.trim();
  return trimmed.startsWith("::ffff:") ? trimmed.slice(7) : trimmed;
}

function getFamilyLabel(value: string): "ipv4" | "ipv6" | null {
  const family = isIP(value);
  if (family === 4) return "ipv4";
  if (family === 6) return "ipv6";
  return null;
}

export function isIpAllowed(
  ipAddress: string | null | undefined,
  allowlist: string[] | null | undefined
): boolean {
  const configuredEntries = (allowlist ?? []).map((entry) => entry.trim()).filter(Boolean);
  if (!configuredEntries.length) return true;
  if (!ipAddress?.trim()) return false;

  const normalizedIp = normalizeIp(ipAddress);
  const family = getFamilyLabel(normalizedIp);
  if (!family) return false;

  const blockList = new BlockList();
  let hasValidEntry = false;

  for (const rawEntry of configuredEntries) {
    const [rawBase, rawPrefix] = rawEntry.split("/", 2);
    const baseAddress = normalizeIp(rawBase);
    const entryFamily = getFamilyLabel(baseAddress);
    if (!entryFamily) continue;

    try {
      if (rawPrefix !== undefined) {
        const prefix = Number.parseInt(rawPrefix, 10);
        if (!Number.isInteger(prefix)) continue;
        blockList.addSubnet(baseAddress, prefix, entryFamily);
      } else {
        blockList.addAddress(baseAddress, entryFamily);
      }
      hasValidEntry = true;
    } catch {
      continue;
    }
  }

  if (!hasValidEntry) return false;
  return blockList.check(normalizedIp, family);
}
