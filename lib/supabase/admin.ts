import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getAdminEnv } from "@/lib/admin/env";

// Only use on server side — never expose to client
export function createAdminClient() {
  const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = getAdminEnv();

  return createClient<Database>(
    NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
