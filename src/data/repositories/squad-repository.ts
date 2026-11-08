import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";

/**
 * Explicit reads avoid a fragile deep PostgREST relation immediately after a
 * transfer has changed a squad-member row and the page is revalidated.
 */
export async function getMySquad(gamerId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: squad, error: squadError } = await supabase.from("squads").select("id,name").eq("gamer_id", gamerId).maybeSingle();
  if (squadError) throw new Error("Impossible de charger votre équipe.");
  if (!squad) return null;
  const { data: members, error: membersError } = await supabase.from("squad_members").select("player_id,acquired_value,is_starter,is_captain").eq("squad_id", squad.id);
  if (membersError) throw new Error("Impossible de charger les joueurs de votre équipe.");
  const ids = (members ?? []).map((member) => member.player_id);
  // A squad emptied by an account reset counts as "no team yet": the manager rebuilds it through onboarding.
  if (!ids.length) return null;
  const { data: players, error: playersError } = await supabase.from("players").select("id,first_name,last_name,position,club_id,marketfoot_value").in("id", ids);
  if (playersError) throw new Error("Impossible de charger les fiches joueurs.");
  const clubIds = [...new Set((players ?? []).map((player) => player.club_id))];
  const { data: clubs, error: clubsError } = clubIds.length ? await supabase.from("clubs").select("id,name").in("id", clubIds) : { data: [], error: null };
  if (clubsError) throw new Error("Impossible de charger les clubs.");
  const playersById = new Map((players ?? []).map((player) => [player.id, player]));
  const clubsById = new Map((clubs ?? []).map((club) => [club.id, club]));
  return {
    ...squad,
    squad_members: (members ?? []).flatMap((member) => {
      const player = playersById.get(member.player_id);
      return player ? [{ ...member, players: { ...player, clubs: clubsById.get(player.club_id) ?? null } }] : [];
    }),
  };
}
