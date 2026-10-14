import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service-role client: bypasses row-level security. Only use it on the server,
// for webhooks and admin-only actions, after checking the caller's permissions.
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
