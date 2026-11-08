import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** Every administrative write leaves a row in `admin_audit_log` (who, what, before / after). */
export async function audit(actorId: string, action: string, entityType: string, entityId: string | null, afterState: unknown, beforeState?: unknown) {
  await createSupabaseAdminClient().from("admin_audit_log").insert({ actor_id: actorId, action, entity_type: entityType, entity_id: entityId, before_state: beforeState ?? null, after_state: afterState ?? null });
}
