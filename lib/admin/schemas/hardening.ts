import { z } from "zod";

export const updateProfileSchema = z.object({
  adminId: z.string().uuid(),
  displayName: z.string().trim().min(2).max(120),
});

export const confirmSensitiveAccessSchema = z.object({
  password: z.string().min(1).max(200),
});

export const revokeManagedSessionSchema = z.object({
  sessionId: z.string().uuid(),
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1).max(200),
  newPassword: z.string().min(8).max(200),
});

export const saveSegmentViewSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).optional().nullable(),
  filters: z.record(z.string(), z.string()),
  isShared: z.boolean().optional(),
});

export const deleteSegmentViewSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
});

export const addUserNoteSchema = z.object({
  userId: z.string().uuid(),
  noteType: z.enum(["general", "support", "finance", "risk", "moderation"]),
  body: z.string().trim().min(3).max(4000),
  isPinned: z.boolean().optional(),
});

export const toggleUserNotePinSchema = z.object({
  noteId: z.string().uuid(),
  userId: z.string().uuid(),
  nextPinnedState: z.boolean(),
});

export const userTagAssignmentSchema = z.object({
  userId: z.string().uuid(),
  tagId: z.string().uuid(),
});

export const assignUserFlagSchema = z.object({
  userId: z.string().uuid(),
  flagId: z.string().uuid(),
  reason: z.string().trim().min(3).max(500),
});

export const resolveUserFlagSchema = z.object({
  assignmentId: z.string().uuid(),
  userId: z.string().uuid(),
  reason: z.string().trim().min(3).max(500),
});

const transactionValuesSchema = z.object({
  amount: z.coerce.number().finite(),
  type: z.enum(["income", "expense"]),
  category: z.string().trim().min(1).max(120),
  note: z.string().trim().max(4000).optional().nullable(),
  date: z.string().trim().min(1).max(40),
});

export const createTransactionSchema = z.object({
  userId: z.string().uuid(),
  values: transactionValuesSchema,
});

export const updateTransactionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  values: transactionValuesSchema,
});

export const deleteTransactionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
});

export const userUpdateSchema = z.object({
  id: z.string().uuid(),
  values: z.object({
    display_name: z.string().trim().max(120).optional().nullable(),
    is_email_verified: z.boolean(),
    profile_image_url: z.string().trim().max(4000).optional().nullable(),
    profile_image: z.string().trim().max(20000).optional().nullable(),
    custom_categories: z.unknown().optional().nullable(),
    last_active_at: z.string().trim().max(40).optional().nullable(),
  }),
});

export const setUserVerificationSchema = z.object({
  id: z.string().uuid(),
  isVerified: z.boolean(),
});

export const userIdSchema = z.object({
  id: z.string().uuid(),
});

export const subscriptionUpsertSchema = z.object({
  userId: z.string().uuid(),
  values: z.object({
    plan: z.string().trim().min(1).max(64),
    status: z.string().trim().min(1).max(64),
    platform: z.string().trim().max(64).optional().nullable(),
    trial_start: z.string().trim().max(40).optional().nullable(),
    trial_end: z.string().trim().max(40).optional().nullable(),
    subscription_start: z.string().trim().max(40).optional().nullable(),
    subscription_end: z.string().trim().max(40).optional().nullable(),
    current_period_start: z.string().trim().max(40).optional().nullable(),
    current_period_end: z.string().trim().max(40).optional().nullable(),
    stripe_customer_id: z.string().trim().max(128).optional().nullable(),
    stripe_subscription_id: z.string().trim().max(128).optional().nullable(),
    apple_transaction_id: z.string().trim().max(128).optional().nullable(),
  }),
});

export const deleteSubscriptionSchema = z.object({
  subscriptionId: z.string().uuid(),
  userId: z.string().uuid(),
});
