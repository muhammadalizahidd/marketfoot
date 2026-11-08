import "server-only";
import { ensureRulesSettings } from "@/services/rules-settings";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { validateDirectTransfer } from "@/rules";

export async function completeDirectTransfer(input: { gamerId: string; matchdayId: string; matchdayNumber: number; soldPlayerId: string; boughtPlayerId: string; soldValue: number; boughtValue: number; budget: number; transfersAlreadyMade: number }) {
  await ensureRulesSettings();
  const decision = validateDirectTransfer({ budget: input.budget, soldValue: input.soldValue, boughtValue: input.boughtValue, matchday: input.matchdayNumber, transfersAlreadyMade: input.transfersAlreadyMade });
  if (!decision.ok) return decision;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("complete_direct_transfer", {
    p_gamer_id: input.gamerId, p_matchday_id: input.matchdayId, p_sold_player_id: input.soldPlayerId, p_bought_player_id: input.boughtPlayerId,
    p_sold_value: input.soldValue, p_bought_value: input.boughtValue, p_tax: decision.value.tax, p_resulting_budget: decision.value.resultingBudget,
  });
  if (error) throw new Error("Impossible de finaliser le transfert.");
  return { ok: true as const, value: { transferId: data, ...decision.value } };
}
