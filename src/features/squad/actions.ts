"use server";

import { SITE_FROZEN_MESSAGE, siteFrozenReason } from "@/lib/site-state";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validateLineup } from "@/rules";

export type LineupActionState = { error?: string; success?: string };
const schema = z.object({ starterIds: z.array(z.string().uuid()).length(11), captainId: z.string().uuid(), matchdayId: z.string().uuid() });

export async function saveLineup(_: LineupActionState, formData: FormData): Promise<LineupActionState> {
  if (await siteFrozenReason()) return { error: SITE_FROZEN_MESSAGE };
  let payload: unknown;
  try { payload = JSON.parse(String(formData.get("lineup") ?? "{}")); } catch { return { error: "La composition envoyée est invalide." }; }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return { error: "Sélectionnez 11 titulaires et un capitaine." };
  const rules = validateLineup(parsed.data.starterIds, parsed.data.captainId);
  if (!rules.ok) return { error: rules.message };
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Votre session a expiré. Connectez-vous à nouveau." };
  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc("update_squad_lineup", { p_gamer_id: user.id, p_starter_ids: rules.value.starterIds, p_captain_id: rules.value.captainId, p_matchday_id: parsed.data.matchdayId });
  if (error) {
    const reason = error.message;
    if (reason.includes("MATCHDAY_NOT_OPEN")) return { error: "La journée n’est plus ouverte : la composition et le capitaine ne peuvent plus être modifiés." };
    if (reason.includes("TEAM_FROZEN")) return { error: "Un joueur concerné est déjà figé car son match commence dans moins de deux heures." };
    if (reason.includes("FORMATION_REQUIRED")) return { error: "La composition doit respecter le 1-4-3-3." };
    if (reason.includes("CAPTAIN_LIMIT")) return { error: "Ce joueur a déjà été capitaine six fois dans ce championnat." };
    if (reason.includes("INVALID_MEMBERS")) return { error: "La sélection contient un joueur qui ne fait plus partie de votre équipe." };
    return { error: "Impossible d’enregistrer la composition. Réessayez après avoir actualisé la page." };
  }
  revalidatePath("/mon-equipe");
  return { success: "Composition enregistrée." };
}
