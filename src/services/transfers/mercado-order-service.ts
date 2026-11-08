import "server-only";
import { ensureRulesSettings } from "@/services/rules-settings";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { validateMercadoOrder } from "@/rules";

export async function submitMercadoOrder(input: { squadId: string; matchdayId: string; matchdayNumber: number; soldPlayerId: string; boughtPlayerId: string; soldValue: number; boughtValue: number; availableMercadoBudget: number; transfersAlreadyMade: number }) {
  await ensureRulesSettings();
  const decision = validateMercadoOrder({ availableMercadoBudget: input.availableMercadoBudget, soldValue: input.soldValue, boughtValue: input.boughtValue, matchday: input.matchdayNumber, transfersAlreadyMade: input.transfersAlreadyMade });
  if (!decision.ok) return decision;
  const admin = createSupabaseAdminClient();
  const { data: squad } = await admin.from("squads").select("gamer_id").eq("id", input.squadId).single();
  if (!squad) throw new Error("Équipe introuvable.");
  const { data, error } = await admin.rpc("submit_mercado_order", {
    p_gamer: squad.gamer_id, p_day: input.matchdayId, p_sold: input.soldPlayerId, p_bought: input.boughtPlayerId,
    p_sold_value: input.soldValue, p_bought_value: input.boughtValue, p_tax: decision.value.tax, p_commission: decision.value.fixedCommission,
  });
  if (error) throw new Error("Impossible d’enregistrer l’ordre Mercado.");
  return { ok: true as const, value: { orderId: data, ...decision.value } };
}
