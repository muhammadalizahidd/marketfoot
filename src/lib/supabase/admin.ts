import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getSupabasePublicEnvironment, getSupabaseServiceRoleKey } from "./env";

/** Server-only privileged client. Callers must still authenticate and authorize every operation. */
export function createSupabaseAdminClient() {
  const { url } = getSupabasePublicEnvironment();
  return createClient(url, getSupabaseServiceRoleKey(), { auth: { autoRefreshToken: false, persistSession: false } });
}
