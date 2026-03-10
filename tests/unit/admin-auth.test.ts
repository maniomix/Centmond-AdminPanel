import test from "node:test";
import assert from "node:assert/strict";

import { createSignedToken, verifySignedToken } from "../../lib/admin/token-signing.ts";

const secret = "test-admin-jwt-secret-should-be-long";

interface AdminSessionTokenPayload {
  sid: string;
  sub: string;
  role: string;
  secret: string;
  exp: number;
}

test("admin session tokens round-trip successfully", async () => {
  const token = await createSignedToken<AdminSessionTokenPayload>({
    sid: "session-1",
    sub: "admin-1",
    role: "super_admin",
    secret: "opaque-secret",
    exp: Date.now() + 60_000,
  }, secret);

  const payload = await verifySignedToken<AdminSessionTokenPayload>(token, secret);

  assert.deepEqual(payload, {
    sid: "session-1",
    sub: "admin-1",
    role: "super_admin",
    secret: "opaque-secret",
    exp: payload?.exp,
  });
  assert.ok((payload?.exp ?? 0) > Date.now());
});

test("tampered admin session tokens are rejected", async () => {
  const token = await createSignedToken<AdminSessionTokenPayload>({
    sid: "session-2",
    sub: "admin-2",
    role: "analyst",
    secret: "opaque-secret",
    exp: Date.now() + 60_000,
  }, secret);

  const tampered = `${token.slice(0, -1)}x`;
  const payload = await verifySignedToken<AdminSessionTokenPayload>(tampered, secret);

  assert.equal(payload, null);
});

test("expired admin session tokens are rejected", async () => {
  const token = await createSignedToken<AdminSessionTokenPayload>({
    sid: "session-3",
    sub: "admin-3",
    role: "finance_admin",
    secret: "opaque-secret",
    exp: Date.now() - 1_000,
  }, secret);

  const payload = await verifySignedToken<AdminSessionTokenPayload>(token, secret);

  assert.equal(payload, null);
});
