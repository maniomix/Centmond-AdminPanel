import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  ADMIN_JWT_SECRET: z.string().min(32),
  ADMIN_SESSION_IDLE_MINUTES: z.coerce.number().int().positive().default(30),
  ADMIN_SESSION_ABSOLUTE_HOURS: z.coerce.number().int().positive().default(12),
  ADMIN_LOGIN_RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
  ADMIN_LOGIN_RATE_LIMIT_MAX_ATTEMPTS: z.coerce.number().int().positive().default(10),
});

let cachedEnv: z.infer<typeof envSchema> | null = null;

export function getAdminEnv() {
  if (!cachedEnv) {
    cachedEnv = envSchema.parse({
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      ADMIN_JWT_SECRET: process.env.ADMIN_JWT_SECRET,
      ADMIN_SESSION_IDLE_MINUTES: process.env.ADMIN_SESSION_IDLE_MINUTES,
      ADMIN_SESSION_ABSOLUTE_HOURS: process.env.ADMIN_SESSION_ABSOLUTE_HOURS,
      ADMIN_LOGIN_RATE_LIMIT_WINDOW_MINUTES:
        process.env.ADMIN_LOGIN_RATE_LIMIT_WINDOW_MINUTES,
      ADMIN_LOGIN_RATE_LIMIT_MAX_ATTEMPTS:
        process.env.ADMIN_LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
    });
  }

  return cachedEnv;
}
