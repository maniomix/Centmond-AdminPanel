// Admin panel authentication — completely independent of Supabase Auth
// Uses Web Crypto API (works on both Node.js and Edge runtime)

export const ADMIN_SESSION_COOKIE = "centmond_admin_session";
export const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

export type AdminRole = "super_admin" | "admin" | "viewer";

export interface AdminPayload {
  sub: string; // admin id
  username: string;
  role: AdminRole;
  exp: number; // unix ms
}

function getSecret(): string {
  const s = process.env.ADMIN_JWT_SECRET;
  if (!s) throw new Error("ADMIN_JWT_SECRET is not set");
  return s;
}

async function makeKey(usage: KeyUsage[]) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usage
  );
}

function toBase64Url(input: string): string {
  return btoa(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(input: string): string {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  return atob(padded);
}

function encodeJson(value: unknown): string {
  return toBase64Url(JSON.stringify(value));
}

function decodeJson<T>(value: string): T {
  return JSON.parse(fromBase64Url(value)) as T;
}

function encodeBytes(value: Uint8Array): string {
  let binary = "";
  value.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return toBase64Url(binary);
}

function decodeBytes(value: string): Uint8Array {
  const binary = fromBase64Url(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function isAdminRole(value: string): value is AdminRole {
  return value === "super_admin" || value === "admin" || value === "viewer";
}

export async function createAdminSession(admin: {
  id: string;
  username: string;
  role: AdminRole;
}): Promise<string> {
  const payload: AdminPayload = {
    sub: admin.id,
    username: admin.username,
    role: admin.role,
    exp: Date.now() + SESSION_MAX_AGE * 1000,
  };
  const payloadB64 = encodeJson(payload);
  const key = await makeKey(["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
  const sigB64 = encodeBytes(new Uint8Array(sig));
  return `${payloadB64}.${sigB64}`;
}

export async function verifyAdminSession(token: string): Promise<AdminPayload | null> {
  try {
    const dot = token.lastIndexOf(".");
    if (dot === -1) return null;
    const payloadB64 = token.slice(0, dot);
    const sigB64 = token.slice(dot + 1);

    const key = await makeKey(["verify"]);
    const sig = decodeBytes(sigB64);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      sig as BufferSource,
      new TextEncoder().encode(payloadB64)
    );
    if (!valid) return null;

    const payload = decodeJson<AdminPayload>(payloadB64);
    if (!isAdminRole(payload.role)) return null;
    if (payload.exp < Date.now()) return null;

    return payload;
  } catch {
    return null;
  }
}
