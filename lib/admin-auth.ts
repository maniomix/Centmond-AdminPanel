// Admin panel authentication — completely independent of Supabase Auth
// Uses Web Crypto API (works on both Node.js and Edge runtime)

export const ADMIN_SESSION_COOKIE = "centmond_admin_session";
export const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

export interface AdminPayload {
  sub: string;     // admin id
  username: string;
  role: string;
  exp: number;     // unix ms
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

export async function createAdminSession(admin: {
  id: string;
  username: string;
  role: string;
}): Promise<string> {
  const payload: AdminPayload = {
    sub: admin.id,
    username: admin.username,
    role: admin.role,
    exp: Date.now() + SESSION_MAX_AGE * 1000,
  };
  const payloadB64 = btoa(JSON.stringify(payload));
  const key = await makeKey(["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return `${payloadB64}.${sigB64}`;
}

export async function verifyAdminSession(token: string): Promise<AdminPayload | null> {
  try {
    const dot = token.lastIndexOf(".");
    if (dot === -1) return null;
    const payloadB64 = token.slice(0, dot);
    const sigB64 = token.slice(dot + 1);

    const key = await makeKey(["verify"]);
    const sig = Uint8Array.from(atob(sigB64), (c) => c.charCodeAt(0));
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      sig,
      new TextEncoder().encode(payloadB64)
    );
    if (!valid) return null;

    const payload: AdminPayload = JSON.parse(atob(payloadB64));
    if (payload.exp < Date.now()) return null;

    return payload;
  } catch {
    return null;
  }
}
