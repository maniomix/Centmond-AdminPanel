import { headers } from "next/headers";

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashToken(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );
  return bytesToHex(new Uint8Array(digest));
}

export function createOpaqueToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return bytesToHex(bytes);
}

export async function getRequestMetadata() {
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for");
  const ipAddress = forwardedFor?.split(",")[0]?.trim() ?? requestHeaders.get("x-real-ip");
  const userAgent = requestHeaders.get("user-agent");

  return {
    ipAddress: ipAddress || null,
    userAgent: userAgent || null,
    deviceLabel: buildDeviceLabel(userAgent),
    origin: requestHeaders.get("origin"),
    host: requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
    requestId:
      requestHeaders.get("x-request-id") ??
      requestHeaders.get("cf-ray") ??
      crypto.randomUUID(),
  };
}

function buildDeviceLabel(userAgent: string | null): string | null {
  if (!userAgent) return null;
  if (userAgent.includes("Mac OS X")) return "Mac";
  if (userAgent.includes("Windows")) return "Windows";
  if (userAgent.includes("Android")) return "Android";
  if (userAgent.includes("iPhone") || userAgent.includes("iPad")) return "iOS";
  if (userAgent.includes("Linux")) return "Linux";
  return "Unknown device";
}

export async function assertSameOriginMutation() {
  const { origin, host } = await getRequestMetadata();
  if (!origin || !host) return;

  const normalizedOrigin = new URL(origin).host;
  if (normalizedOrigin !== host) {
    throw new Error("Invalid origin");
  }
}
