"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SITE_FROZEN_MESSAGE, siteFrozenReason } from "@/lib/site-state";
import { bonusIds } from "@/rules/settings";
import { ensureRulesSettings } from "@/services/rules-settings";

export type BonusActionState = { error?: string; success?: string };
const messages: Record<string, string> = {
  BONUS_LOCKED: "Le bonus ne peut plus être modifié : le premier match de la journée est dans moins de 2 heures.",
  BONUS_CLOSED: "Aucune journée ne permet de jouer un bonus pour le moment.",
  BONUS_EXHAUSTED: "Tu as atteint le maximum d’utilisations de ce bonus sur la saison.",
  NO_SQUAD: "Crée d’abord ton équipe.",
};

/** Plays (or changes) the single bonus of the current matchday. An empty `bonusId` takes the bonus back. */
export async function playBonus(_: BonusActionState, form: FormData): Promise<BonusActionState> {
  if (await siteFrozenReason()) return { error: SITE_FROZEN_MESSAGE };
  const parsed = z.object({ matchdayId: z.string().uuid(), bonusId: z.union([z.enum(bonusIds), z.literal("")]) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Bonus invalide." };
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");
  const { settings } = await ensureRulesSettings();
  const db = createSupabaseAdminClient();
  if (!parsed.data.bonusId) {
    const { error } = await db.rpc("unplay_bonus", { p_gamer: user.id, p_matchday: parsed.data.matchdayId });
    if (error) return { error: messages[error.message.match(/[A-Z][A-Z_]{5,}/)?.[0] ?? ""] ?? "Impossible de retirer le bonus." };
  } else {
    const entry = settings.bonus.list.find((item) => item.id === parsed.data.bonusId);
    if (!entry?.enabled) return { error: "Ce bonus n’est pas disponible." };
    const { error } = await db.rpc("play_bonus", { p_gamer: user.id, p_matchday: parsed.data.matchdayId, p_bonus: parsed.data.bonusId, p_max: entry.maxPerSeason });
    if (error) return { error: messages[error.message.match(/[A-Z][A-Z_]{5,}/)?.[0] ?? ""] ?? "Impossible de jouer ce bonus." };
  }
  revalidatePath("/mon-equipe");
  return { success: parsed.data.bonusId ? "Bonus enregistré pour cette journée." : "Bonus retiré." };
}
