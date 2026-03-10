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

async function makeKey(secret: string, usage: KeyUsage[]) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usage
  );
}

export async function createSignedToken<T extends { exp: number }>(
  payload: T,
  secret: string
): Promise<string> {
  const payloadB64 = encodeJson(payload);
  const key = await makeKey(secret, ["sign"]);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payloadB64)
  );
  return `${payloadB64}.${encodeBytes(new Uint8Array(signature))}`;
}

export async function verifySignedToken<T extends { exp: number }>(
  token: string,
  secret: string
): Promise<T | null> {
  try {
    const dot = token.lastIndexOf(".");
    if (dot === -1) return null;

    const payloadB64 = token.slice(0, dot);
    const signature = token.slice(dot + 1);
    const key = await makeKey(secret, ["verify"]);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      decodeBytes(signature) as BufferSource,
      new TextEncoder().encode(payloadB64)
    );

    if (!valid) return null;

    const payload = decodeJson<T>(payloadB64);
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
