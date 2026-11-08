"use server";

import { SITE_FROZEN_MESSAGE, siteFrozenReason } from "@/lib/site-state";

import { ensureRulesSettings } from "@/services/rules-settings";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { calculateInitialBudget, validateInitialSquad } from "@/rules";
import { usernameSchema } from "@/lib/validation/auth";

export type CreateSquadState = { error?: string };
const schema = z.object({ playerIds: z.array(z.string().uuid()).length(19) });

export async function completeOAuthProfile(_: CreateSquadState, formData: FormData): Promise<CreateSquadState> {
  await ensureRulesSettings();
  const parsed = usernameSchema.safeParse(formData.get("username"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Choisissez un pseudo valide." };
  const supabase = await createSupabaseServerClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");
  // Upsert repairs an account whose Auth entry exists but whose profile was
  // manually removed. On normal accounts this updates only the username.
  const { error } = await createSupabaseAdminClient().from("profiles").upsert(
    { id: user.id, username: parsed.data },
    { onConflict: "id" },
  );
  if (error) return { error: "Ce pseudo est déjà utilisé. Choisissez-en un autre." };
  revalidatePath("/onboarding"); return {};
}

export async function createInitialSquad(_: CreateSquadState, formData: FormData): Promise<CreateSquadState> {
  if (await siteFrozenReason()) return { error: SITE_FROZEN_MESSAGE };
  await ensureRulesSettings();
  const parsedIds = z.array(z.string()).safeParse(JSON.parse(String(formData.get("playerIds") ?? "[]")));
  const parsed = schema.safeParse({ playerIds: parsedIds.success ? parsedIds.data : [] });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Vérifiez votre sélection." };
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");
  const [{ data: existing }, { data: players, error: playersError }, { data: catalogue }, { count: settledMatchdays }, { data: profile }] = await Promise.all([
    supabase.from("squads").select("id, squad_members(player_id)").eq("gamer_id", user.id).maybeSingle(),
    supabase.from("players").select("id, club_id, position, marketfoot_value").in("id", parsed.data.playerIds).eq("is_active", true),
    supabase.from("players").select("marketfoot_value").eq("is_active", true),
    supabase.from("matchdays").select("id", { count: "exact", head: true }).eq("status", "settled"),
    supabase.from("profiles").select("username").eq("id", user.id).maybeSingle(),
  ]);
  if (existing && (existing.squad_members ?? []).length > 0) redirect("/mon-equipe");
  if (!profile?.username) return { error: "Votre pseudo est requis avant de créer votre équipe." };
  if (playersError || !players || players.length !== 19) return { error: "Un ou plusieurs joueurs ne sont plus disponibles." };
  if (!catalogue?.length) return { error: "Le budget initial ne peut pas être calculé tant qu’aucun joueur actif n’est disponible." };
  const averageValue = catalogue.reduce((sum, player) => sum + Number(player.marketfoot_value), 0) / catalogue.length;
  const initialBudget = calculateInitialBudget(averageValue, settledMatchdays ?? 0);
  const result = validateInitialSquad(players.map((player) => ({ id: player.id, clubId: player.club_id, position: player.position, value: Number(player.marketfoot_value) })), initialBudget);
  if (!result.ok) return { error: result.message };
  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc("create_initial_squad", {
    p_gamer_id: user.id,
    p_name: profile.username,
    p_members: result.value.map((player) => ({ playerId: player.id, acquiredValue: player.value })),
    p_budget: initialBudget,
  });
  if (error) return { error: "Impossible de créer votre équipe. Réessayez." };
  revalidatePath("/mon-equipe");
  redirect("/mon-equipe");
}
