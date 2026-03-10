import { revalidatePath } from "next/cache";
import {
  auditWithCurrentAdmin,
  type WriteAdminAuditLogInput,
} from "@/lib/admin/audit";
import {
  type AdminContext,
  getAdminContext,
  requireAnyPermission,
  requirePermission,
} from "@/lib/admin/permissions";
import {
  RecentAdminAuthRequiredError,
  requireRecentAdminAuth,
} from "@/lib/admin-session";
import { assertSameOriginMutation } from "@/lib/admin/security";
import type { AdminPermissionKey } from "@/lib/admin/constants";

export interface AdminActionErrorResult {
  code?: string;
  error: string;
}

interface RunAdminMutationResult<T> {
  audit?: Omit<WriteAdminAuditLogInput, "actorAdminId" | "actorRole">;
  revalidatePaths?: string[];
  value: T;
}

interface RunAdminMutationOptions<T> {
  anyPermissions?: AdminPermissionKey[];
  execute: (actor: AdminContext) => Promise<RunAdminMutationResult<T>>;
  permission?: AdminPermissionKey;
  requireRecentAuth?: boolean;
}

export async function runAdminMutation<T>(
  options: RunAdminMutationOptions<T>
): Promise<T> {
  await assertSameOriginMutation();

  let actor: AdminContext;
  if (options.permission) {
    actor = await requirePermission(options.permission);
  } else if (options.anyPermissions?.length) {
    actor = await requireAnyPermission(options.anyPermissions);
  } else {
    const context = await getAdminContext();
    if (!context) {
      throw new Error("Unauthorized");
    }
    actor = context;
  }

  if (options.requireRecentAuth) {
    await requireRecentAdminAuth();
  }

  const result = await options.execute(actor);
  if (result.audit) {
    await auditWithCurrentAdmin(result.audit, { required: true });
  }
  for (const path of result.revalidatePaths ?? []) {
    revalidatePath(path);
  }
  return result.value;
}

export function toAdminActionError(
  error: unknown,
  fallbackMessage: string
): AdminActionErrorResult {
  if (error instanceof RecentAdminAuthRequiredError) {
    return {
      code: error.code,
      error: "Recent password confirmation required. Open Settings > Session Security and confirm your password again.",
    };
  }

  if (error instanceof Error && error.message.trim()) {
    return { error: error.message };
  }

  return { error: fallbackMessage };
}
