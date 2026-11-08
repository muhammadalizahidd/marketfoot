"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AdminActionState } from "./actions";

/** Guarded delete (history blocks it) with an audit row written by the database function. */
export async function deleteResource(_: AdminActionState, form: FormData): Promise<AdminActionState> {
  const actor = await requireAdmin();
  const input = z.object({ resource: z.enum(["seasons", "clubs", "players", "matchdays", "matches"]), id: z.string().uuid(), confirmation: z.literal("delete") }).safeParse(Object.fromEntries(form));
  if (!input.success) return { error: "Confirmez la suppression de cet élément." };
  const { error } = await createSupabaseAdminClient().rpc("admin_delete_resource", { p_actor: actor.id, p_resource: input.data.resource, p_id: input.data.id });
  if (error) return { error: "Suppression impossible : cet élément possède des données liées. Conservez son historique." };
  revalidatePath("/admin", "layout");
  return { success: "Élément supprimé." };
}
