import { getAdminEnv } from "./admin/env";
import type { AdminRole } from "./admin/constants";
import { createSignedToken, verifySignedToken } from "./admin/token-signing";

export const ADMIN_SESSION_COOKIE = "centmond_admin_session";

export interface AdminSessionTokenPayload {
  sid: string;
  sub: string;
  role: AdminRole;
  secret: string;
  exp: number;
}

function getSecret(): string {
  return getAdminEnv().ADMIN_JWT_SECRET;
}

export async function createSignedAdminSessionToken(
  payload: AdminSessionTokenPayload
): Promise<string> {
  return createSignedToken(payload, getSecret());
}

export async function verifySignedAdminSessionToken(
  token: string
): Promise<AdminSessionTokenPayload | null> {
  return verifySignedToken<AdminSessionTokenPayload>(token, getSecret());
}
