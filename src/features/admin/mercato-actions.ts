"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/admin";
import { audit } from "@/lib/admin/audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { executeMercado } from "@/services/transfers/mercado-execution-service";
import type { AdminActionState } from "./actions";

const uuid = z.string().uuid();
const refresh = () => { for (const path of ["/admin/mercato", "/admin", "/transferts", "/mon-equipe", "/pronostics", "/joueurs"]) revalidatePath(path); };
const code = (message: string) => message.match(/[A-Z][A-Z_]{5,}/)?.[0];
const failures: Record<string, string> = {
  MERCADO_ORDERS_MUST_BE_EXECUTED: "Des ordres sont encore en attente : mettez à jour les valeurs avant de dégeler.",
  INVALID_LIFECYCLE_TRANSITION: "Cette transition n’est pas autorisée dans l’état actuel de la journée.",
  NO_COMPLETED_RUN: "Aucune exécution à annuler.", RUN_NOT_REVERSIBLE: "Cette exécution est trop ancienne pour être annulée automatiquement.",
  MATCHDAY_NOT_MERCADO: "La journée n’est plus en phase Mercato.", MATCHDAY_CLOSED: "La journée est clôturée : ce transfert ne peut plus être annulé.",
  INSUFFICIENT_BUDGET_TO_REVERSE: "Le budget du manager est insuffisant pour annuler ce transfert.", BOUGHT_PLAYER_NOT_OWNED: "Le joueur acheté n’est plus dans l’équipe.",
  SOLD_PLAYER_ALREADY_OWNED: "Le joueur vendu est déjà de retour dans l’équipe.", ALREADY_CANCELLED: "Ce transfert est déjà annulé.",
};

async function setSite(actorId: string, frozen: boolean, reason: string) {
  const db = createSupabaseAdminClient();
  await db.from("site_state").update({ frozen, reason: frozen ? reason : null, updated_at: new Date().toISOString(), updated_by: actorId }).eq("id", true);
}
async function loadDay(matchdayId: string) {
  const { data } = await createSupabaseAdminClient().from("matchdays").select("id,number,status,mercato_stage,mercato_closes_at").eq("id", matchdayId).single();
  return data;
}
const dayInput = z.object({ matchdayId: uuid });

/** "Ouvrir le mercato": the earliest open matchday enters its Mercato window (stage "open" is set by the database). */
export async function openMercato(_: AdminActionState, form: FormData): Promise<AdminActionState> {
  const actor = await requireAdmin();
  const db = createSupabaseAdminClient();
  const { data: day } = await db.from("matchdays").select("id,number,seasons!inner(status)").eq("status", "open").eq("seasons.status", "active").order("number").limit(1).maybeSingle();
  if (!day) return { error: "Aucune journée ouverte à faire passer en Mercato (publiez d’abord une journée)." };
  const { error } = await db.rpc("admin_transition_matchday", { p_actor_id: actor.id, p_matchday_id: day.id, p_next_status: "mercado" });
  if (error) return { error: failures[code(error.message) ?? ""] ?? "Ouverture impossible." };
  await setSite(actor.id, false, "");
  await audit(actor.id, "mercato.open", "matchday", day.id, { number: day.number });
  refresh();
  return { success: `Mercato de la journée ${day.number} ouvert.` };
}

export async function extendMercato(_: AdminActionState, form: FormData): Promise<AdminActionState> {
  const actor = await requireAdmin();
  const parsed = dayInput.extend({ hours: z.coerce.number().min(0.5).max(72) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Durée invalide (0,5 à 72 heures)." };
  const day = await loadDay(parsed.data.matchdayId);
  if (!day || day.mercato_stage !== "open") return { error: "Le mercato n’est pas ouvert." };
  const base = Math.max(Date.now(), day.mercato_closes_at ? new Date(day.mercato_closes_at).getTime() : 0);
  const closes = new Date(base + parsed.data.hours * 3_600_000).toISOString();
  await createSupabaseAdminClient().from("matchdays").update({ mercato_closes_at: closes }).eq("id", day.id);
  await audit(actor.id, "mercato.extend", "matchday", day.id, { closes });
  refresh();
  return { success: "Mercato prolongé." };
}

/** "Fermer le mercato et geler le site": no more orders; the whole site becomes read-only. */
export async function freezeMercato(_: AdminActionState, form: FormData): Promise<AdminActionState> {
  const actor = await requireAdmin();
  const parsed = dayInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Journée invalide." };
  const day = await loadDay(parsed.data.matchdayId);
  if (!day || day.status !== "mercado" || day.mercato_stage !== "open") return { error: "Le mercato n’est pas ouvert." };
  await createSupabaseAdminClient().from("matchdays").update({ mercato_stage: "frozen", mercato_closes_at: new Date().toISOString() }).eq("id", day.id);
  await setSite(actor.id, true, `Gel total — Mercato J${day.number}`);
  await audit(actor.id, "mercato.freeze", "matchday", day.id, { number: day.number });
  refresh();
  return { success: "Mercato fermé : le site est gelé." };
}

export async function reopenMercato(_: AdminActionState, form: FormData): Promise<AdminActionState> {
  const actor = await requireAdmin();
  const parsed = dayInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Journée invalide." };
  const day = await loadDay(parsed.data.matchdayId);
  if (!day || day.status !== "mercado" || day.mercato_stage !== "frozen") return { error: "Le mercato ne peut être rouvert que pendant le gel total." };
  await createSupabaseAdminClient().from("matchdays").update({ mercato_stage: "open" }).eq("id", day.id);
  await setSite(actor.id, false, "");
  await audit(actor.id, "mercato.reopen", "matchday", day.id, { number: day.number });
  refresh();
  return { success: "Mercato rouvert : le site est dégelé." };
}

/** "Mettre à jour les valeurs": executes the order book and applies the demand effect. */
export async function updateMercatoValues(_: AdminActionState, form: FormData): Promise<AdminActionState> {
  const actor = await requireAdmin();
  const parsed = dayInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Journée invalide." };
  const day = await loadDay(parsed.data.matchdayId);
  if (!day || day.status !== "mercado" || day.mercato_stage !== "frozen") return { error: "Gelez d’abord le site (Gel total) avant de mettre à jour les valeurs." };
  try {
    const review = await executeMercado(actor.id, day.id);
    await createSupabaseAdminClient().from("matchdays").update({ mercato_stage: "updated" }).eq("id", day.id);
    refresh();
    return { success: `Valeurs mises à jour : ${review.orders.filter((order) => order.outcome === "executed").length} ordre(s) exécuté(s).` };
  } catch (error) { return { error: error instanceof Error ? error.message : "La mise à jour a échoué." }; }
}

/** "Annuler le mercato": reverses the executed run (orders back to pending, budgets and values restored). */
export async function rollbackMercato(_: AdminActionState, form: FormData): Promise<AdminActionState> {
  const actor = await requireAdmin();
  const parsed = dayInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Journée invalide." };
  const day = await loadDay(parsed.data.matchdayId);
  if (!day || day.status !== "mercado" || day.mercato_stage !== "updated") return { error: "Aucune mise à jour à annuler." };
  const db = createSupabaseAdminClient();
  const { data, error } = await db.rpc("admin_rollback_mercado_run", { p_actor: actor.id, p_matchday: day.id });
  if (error) return { error: failures[code(error.message) ?? ""] ?? "Annulation impossible." };
  await db.from("matchdays").update({ mercato_stage: "frozen" }).eq("id", day.id);
  refresh();
  return { success: `Mercato annulé : ${data ?? 0} ordre(s) remis en attente.` };
}

/** "Dégeler le site": closes the Mercato matchday and lifts the freeze. */
export async function thawSite(_: AdminActionState, form: FormData): Promise<AdminActionState> {
  const actor = await requireAdmin();
  const parsed = dayInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Journée invalide." };
  const day = await loadDay(parsed.data.matchdayId);
  if (!day || day.status !== "mercado" || day.mercato_stage !== "updated") return { error: "Mettez d’abord à jour les valeurs." };
  const db = createSupabaseAdminClient();
  const { error } = await db.rpc("admin_transition_matchday", { p_actor_id: actor.id, p_matchday_id: day.id, p_next_status: "closed" });
  if (error) return { error: failures[code(error.message) ?? ""] ?? "Dégel impossible." };
  await db.from("matchdays").update({ thaw_at: new Date().toISOString() }).eq("id", day.id);
  await setSite(actor.id, false, "");
  await audit(actor.id, "mercato.thaw", "matchday", day.id, { number: day.number });
  refresh();
  return { success: "Site dégelé : les transferts libres sont de nouveau possibles." };
}

export async function cancelMercadoOrderAdmin(_: AdminActionState, form: FormData): Promise<AdminActionState> {
  const actor = await requireAdmin();
  const parsed = z.object({ orderId: uuid }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Ordre invalide." };
  const db = createSupabaseAdminClient();
  const { data: order } = await db.from("mercado_orders").select("id,status,matchday_id").eq("id", parsed.data.orderId).single();
  if (!order || order.status !== "pending") return { error: "Cet ordre n’est plus en attente." };
  const day = await loadDay(order.matchday_id);
  if (!day || day.status !== "mercado" || day.mercato_stage === "updated") return { error: "L’ordre ne peut plus être annulé (valeurs déjà mises à jour)." };
  const { error } = await db.from("mercado_orders").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", order.id).eq("status", "pending");
  if (error) return { error: "Annulation impossible." };
  await audit(actor.id, "mercado.order.cancel", "mercado_order", order.id, { by: "admin" });
  refresh();
  return { success: "Ordre annulé : le manager récupère un emplacement." };
}

export async function cancelFreeTransfer(_: AdminActionState, form: FormData): Promise<AdminActionState> {
  const actor = await requireAdmin();
  const parsed = z.object({ transferId: uuid }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Transfert invalide." };
  const { error } = await createSupabaseAdminClient().rpc("admin_cancel_direct_transfer", { p_actor: actor.id, p_transfer: parsed.data.transferId });
  if (error) return { error: failures[code(error.message) ?? ""] ?? "Annulation impossible." };
  refresh();
  return { success: "Transfert annulé : équipe, budget et valeurs rétablis." };
}
