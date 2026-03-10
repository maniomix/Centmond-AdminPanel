import { z } from "zod";

export const financeEventSchema = z.object({
  userId: z.string().uuid().optional().nullable(),
  subscriptionId: z.string().uuid().optional().nullable(),
  transactionId: z.string().uuid().optional().nullable(),
  eventType: z.string().trim().min(1).max(64),
  status: z
    .enum(["recorded", "pending_provider_action", "resolved", "cancelled"])
    .default("recorded"),
  amount: z.number().int().optional().nullable(),
  currency: z.string().trim().min(3).max(8).default("EUR"),
  provider: z.string().trim().max(64).optional().nullable(),
  referenceId: z.string().trim().max(128).optional().nullable(),
  reason: z.string().trim().min(3).max(500),
  note: z.string().trim().max(4000).optional().nullable(),
});

export const exportJobSchema = z.object({
  exportType: z.string().trim().min(1).max(64),
  targetScope: z.enum(["users", "subscriptions", "audit_logs", "review_queue"]),
  format: z.enum(["csv"]).default("csv"),
  reason: z.string().trim().min(3).max(500),
  filters: z.record(z.string(), z.string()).default({}),
});

export const featureFlagSchema = z.object({
  key: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9._-]+$/),
  label: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional().nullable(),
  enabled: z.boolean().default(false),
  rolloutPercentage: z.number().int().min(0).max(100).default(100),
  audienceFilters: z.record(z.string(), z.unknown()).optional().nullable(),
  reason: z.string().trim().min(3).max(500),
});

export const internalSettingSchema = z.object({
  key: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9._-]+$/),
  label: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional().nullable(),
  value: z.record(z.string(), z.unknown()),
  isSensitive: z.boolean().default(false),
  reason: z.string().trim().min(3).max(500),
});

export const reviewDecisionSchema = z.object({
  userId: z.string().uuid(),
  status: z.enum([
    "under_review",
    "escalated",
    "approved",
    "rejected",
    "restricted",
    "false_positive",
    "resolved",
  ]),
  priority: z.string().trim().min(1).max(32).default("normal"),
  reason: z.string().trim().min(3).max(500),
  assignedToAdminId: z.string().uuid().optional().nullable(),
});

export const supportHandoffSchema = z.object({
  userId: z.string().uuid(),
  toAdminId: z.string().uuid().optional().nullable(),
  priority: z.string().trim().min(1).max(32).default("normal"),
  summary: z.string().trim().min(3).max(200),
  details: z.string().trim().max(4000).optional().nullable(),
});

export const userSessionActionSchema = z.object({
  userId: z.string().uuid(),
  sessionId: z.string().uuid().optional().nullable(),
  deviceId: z.string().uuid().optional().nullable(),
  reason: z.string().trim().min(3).max(500),
});

export const bulkJobInputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.enum(["suspend", "reactivate", "mark_under_review"]),
    userIds: z.array(z.string().uuid()).min(1),
    reason: z.string().trim().min(3).max(500),
  }),
  z.object({
    action: z.literal("add_tag"),
    userIds: z.array(z.string().uuid()).min(1),
    reason: z.string().trim().min(3).max(500),
    tagId: z.string().uuid(),
  }),
]);
