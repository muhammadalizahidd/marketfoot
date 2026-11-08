import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Returns the real Supabase user's ID, or null if not authenticated.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}
