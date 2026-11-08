import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const SITE_FROZEN_MESSAGE = "Le site est gelé pendant la mise à jour du Mercato. Réessayez après le dégel.";

/** Returns the freeze reason while the admin "Gel total" is active, otherwise null. */
export async function siteFrozenReason(): Promise<string | null> {
  const { data } = await createSupabaseAdminClient().from("site_state").select("frozen,reason").eq("id", true).maybeSingle();
  return data?.frozen ? data.reason || "Site gelé" : null;
}
