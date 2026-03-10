"use server";

import { runAdminMutation, toAdminActionError } from "@/lib/admin/mutations";
import { userSessionActionSchema } from "@/lib/admin/schemas/phase2";
import {
  markUserDeviceSuspicious,
  revokeAllUserSessions,
  revokeUserSession,
} from "@/lib/admin/services/user-security";

export async function revokeUserSessionAction(values: unknown) {
  let parsed: ReturnType<typeof userSessionActionSchema.parse>;
  try {
    parsed = userSessionActionSchema.parse(values);
  } catch {
    return { error: "Invalid session action payload" };
  }

  const sessionId = parsed.sessionId;
  if (!sessionId) {
    return { error: "Session is required" };
  }

  try {
    return await runAdminMutation({
      permission: "users.sessions.manage",
      requireRecentAuth: true,
      execute: async (actor) => {
        await revokeUserSession({
          sessionId,
          actorAdminId: actor.id,
          reason: parsed.reason,
        });

        return {
          value: {},
          audit: {
            actionType: "user.session_revoked",
            category: "security",
            severity: "warning",
            targetEntityType: "user_session",
            targetEntityId: sessionId,
            targetSummary: parsed.userId,
            reason: parsed.reason,
          },
          revalidatePaths: [`/admin/users/${parsed.userId}`, "/admin/users"],
        };
      },
    });
  } catch (error) {
    return toAdminActionError(error, "Failed to revoke user session");
  }
}

export async function revokeAllUserSessionsAction(values: unknown) {
  let parsed: ReturnType<typeof userSessionActionSchema.parse>;
  try {
    parsed = userSessionActionSchema.parse(values);
  } catch {
    return { error: "Invalid session action payload" };
  }

  try {
    return await runAdminMutation({
      permission: "users.sessions.manage",
      requireRecentAuth: true,
      execute: async (actor) => {
        await revokeAllUserSessions({
          userId: parsed.userId,
          actorAdminId: actor.id,
          reason: parsed.reason,
        });

        return {
          value: {},
          audit: {
            actionType: "user.sessions_revoked_all",
            category: "security",
            severity: "warning",
            targetEntityType: "user",
            targetEntityId: parsed.userId,
            targetSummary: parsed.userId,
            reason: parsed.reason,
          },
          revalidatePaths: [`/admin/users/${parsed.userId}`, "/admin/users"],
        };
      },
    });
  } catch (error) {
    return toAdminActionError(error, "Failed to revoke user sessions");
  }
}

export async function markUserDeviceSuspiciousAction(
  values: unknown,
  nextState: boolean
) {
  let parsed: ReturnType<typeof userSessionActionSchema.parse>;
  try {
    parsed = userSessionActionSchema.parse(values);
  } catch {
    return { error: "Invalid device action payload" };
  }

  const deviceId = parsed.deviceId;
  if (!deviceId) {
    return { error: "Device is required" };
  }

  try {
    return await runAdminMutation({
      permission: "users.sessions.manage",
      execute: async () => {
        await markUserDeviceSuspicious({
          deviceId,
          isSuspicious: nextState,
        });

        return {
          value: {},
          audit: {
            actionType: nextState ? "user.device_marked_suspicious" : "user.device_cleared",
            category: "security",
            targetEntityType: "user_device",
            targetEntityId: deviceId,
            targetSummary: parsed.userId,
            reason: parsed.reason,
            afterState: { isSuspicious: nextState },
          },
          revalidatePaths: [`/admin/users/${parsed.userId}`],
        };
      },
    });
  } catch (error) {
    return toAdminActionError(error, "Failed to update device state");
  }
}
