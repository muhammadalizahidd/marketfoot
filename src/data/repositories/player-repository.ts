import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function listActivePlayers() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("players")
    .select("id, first_name, last_name, position, marketfoot_value, clubs(name, short_name)")
    .eq("is_active", true)
    .order("last_name");

  if (error) throw new Error("Impossible de charger les joueurs.");
  return data;
}
