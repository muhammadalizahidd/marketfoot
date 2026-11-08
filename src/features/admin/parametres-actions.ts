"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/admin";
import { audit } from "@/lib/admin/audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AdminActionState } from "./actions";

const uuid = z.string().uuid();

/** Manual maintenance switch: the same read-only mode the Mercato "Gel total" uses. */
export async function toggleSiteFreeze(_: AdminActionState, form: FormData): Promise<AdminActionState> {
  const actor = await requireAdmin();
  const parsed = z.object({ frozen: z.enum(["true", "false"]), reason: z.string().trim().max(200).optional() }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Demande invalide." };
  const frozen = parsed.data.frozen === "true";
  const { error } = await createSupabaseAdminClient().from("site_state").update({ frozen, reason: frozen ? parsed.data.reason || "Maintenance" : null, updated_at: new Date().toISOString(), updated_by: actor.id }).eq("id", true);
  if (error) return { error: "Impossible de modifier l’état du site." };
  await audit(actor.id, frozen ? "site.freeze" : "site.thaw", "site_state", null, { reason: parsed.data.reason ?? null });
  for (const path of ["/admin", "/admin/parametres", "/admin/mercato", "/mon-equipe", "/transferts", "/pronostics"]) revalidatePath(path);
  return { success: frozen ? "Site gelé : les managers sont en lecture seule." : "Site dégelé." };
}

export async function promoteAdmin(_: AdminActionState, form: FormData): Promise<AdminActionState> {
  const actor = await requireAdmin();
  const username = z.string().trim().min(3).max(32).safeParse(form.get("username"));
  if (!username.success) return { error: "Saisissez le pseudo exact du compte." };
  const db = createSupabaseAdminClient();
  const { data: target } = await db.from("profiles").select("id,role,banned_at").eq("username", username.data).maybeSingle();
  if (!target) return { error: "Aucun compte avec ce pseudo." };
  if (target.role === "admin") return { error: "Ce compte est déjà administrateur." };
  if (target.banned_at) return { error: "Un compte banni ne peut pas devenir administrateur." };
  const { error } = await db.from("profiles").update({ role: "admin" }).eq("id", target.id);
  if (error) return { error: "Promotion impossible." };
  await audit(actor.id, "admin.promote", "profile", target.id, { role: "admin" }, { role: target.role });
  revalidatePath("/admin/parametres");
  return { success: "Administrateur ajouté." };
}

export async function demoteAdmin(_: AdminActionState, form: FormData): Promise<AdminActionState> {
  const actor = await requireAdmin();
  const id = uuid.safeParse(form.get("adminId"));
  if (!id.success) return { error: "Compte invalide." };
  if (id.data === actor.id) return { error: "Vous ne pouvez pas retirer vos propres droits." };
  const db = createSupabaseAdminClient();
  const { count } = await db.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin");
  if ((count ?? 0) <= 1) return { error: "Il doit rester au moins un administrateur." };
  const { error } = await db.from("profiles").update({ role: "gamer" }).eq("id", id.data);
  if (error) return { error: "Modification impossible." };
  await audit(actor.id, "admin.demote", "profile", id.data, { role: "gamer" }, { role: "admin" });
  revalidatePath("/admin/parametres");
  return { success: "Droits administrateur retirés." };
}

/** Linked-account data retention (decision D3): sign-in hashes older than 90 days are removed. */
export async function purgeIpEvents(_: AdminActionState): Promise<AdminActionState> {
  const actor = await requireAdmin();
  const { data } = await createSupabaseAdminClient().from("profile_ip_events").delete().lt("created_at", new Date(Date.now() - 90 * 86_400_000).toISOString()).select("id");
  await audit(actor.id, "privacy.purge_ip_events", "profile_ip_events", null, { removed: data?.length ?? 0 });
  return { success: `${data?.length ?? 0} empreinte(s) de connexion supprimée(s).` };
}
