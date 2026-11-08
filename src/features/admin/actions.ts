"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/admin";
import { executeSettlement, rollbackSettlement } from "@/services/settlements/settlement-service";

export type AdminActionState = { error?: string; success?: string };
const uuid = z.string().uuid();

/** Saisie → Publier: credits the accounts once, after the review (idempotent in the database). */
export async function executeSettlementAction(_: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const actor = await requireAdmin();
  const parsed = z.object({ settlementId: uuid, confirmation: z.literal("execute") }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Confirmez que vous souhaitez comptabiliser ce règlement." };
  try {
    const review = await executeSettlement(actor.id, parsed.data.settlementId);
    for (const path of ["/admin", "/admin/saisie", "/admin/saisie/publication", "/mon-equipe", "/classements"]) revalidatePath(path);
    return { success: `Règlement exécuté : ${review.effects.length} effets comptabilisés.` };
  } catch (error) { return { error: error instanceof Error ? error.message : "Le règlement a échoué." }; }
}

/** Historical correction (PRD §19.5): cancels a completed settlement so the sheet can be fixed and the day re-published. */
export async function rollbackSettlementAction(_: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const actor = await requireAdmin();
  const parsed = z.object({ settlementId: uuid, reason: z.string().trim().min(8).max(500) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Indiquez un motif de correction d’au moins 8 caractères." };
  try {
    await rollbackSettlement(actor.id, parsed.data.settlementId, parsed.data.reason);
    for (const path of ["/admin", "/admin/saisie", "/admin/saisie/publication", "/mon-equipe", "/classements"]) revalidatePath(path);
    return { success: "Règlement annulé. Corrigez la feuille puis republiez la journée." };
  } catch (error) { return { error: error instanceof Error ? error.message : "Le retour arrière a échoué." }; }
}
