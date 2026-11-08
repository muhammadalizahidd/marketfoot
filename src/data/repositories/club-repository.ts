import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { one } from "@/lib/supabase/relation";
import type { ClubFixture, ClubPlayerRow } from "@/components/club/club-profile";

const positionOrder = { GK: 0, DF: 1, MF: 2, FW: 3 } as const;
const posLetter = { GK: "G", DF: "D", MF: "M", FW: "A" } as const;
type Totals = { matches: number; starters: number; goals: number; ownGoals: number; assists: number; penalties: number; yellow: number; red: number };
const empty = (): Totals => ({ matches: 0, starters: 0, goals: 0, ownGoals: 0, assists: 0, penalties: 0, yellow: 0, red: 0 });

/** Real football club: squad with season statistics and the season calendar (current season). */
export async function getClubProfile(clubId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(clubId)) return null;
  const db = createSupabaseAdminClient();
  const { data: club } = await db.from("clubs").select("id,name").eq("id", clubId).maybeSingle();
  if (!club) return null;
  const { data: season } = await db.from("seasons").select("id").order("is_current", { ascending: false }).order("starts_on", { ascending: false }).limit(1).maybeSingle();
  const [{ data: players }, { data: matches }, { data: clubs }] = await Promise.all([
    db.from("players").select("id,first_name,last_name,position,marketfoot_value").eq("club_id", clubId).eq("is_active", true),
    db.from("matches").select("id,kickoff_at,home_club_id,away_club_id,home_score,away_score,is_postponed,matchdays!inner(id,number,season_id)").or(`home_club_id.eq.${clubId},away_club_id.eq.${clubId}`).order("kickoff_at"),
    db.from("clubs").select("id,name,short_name"),
  ]);
  const ids = (players ?? []).map((player) => player.id);
  const { data: stats } = ids.length ? await db.from("player_match_stats").select("player_id,started,minutes_played,goals,own_goals,assists,penalties_scored,yellow_cards,red_cards").in("player_id", ids) : { data: [] };
  const totals = new Map<string, Totals>();
  for (const stat of stats ?? []) {
    const current = totals.get(stat.player_id) ?? empty();
    current.matches += stat.minutes_played > 0 ? 1 : 0;
    current.starters += stat.started ? 1 : 0;
    current.goals += stat.goals; current.ownGoals += stat.own_goals; current.assists += stat.assists;
    current.penalties += stat.penalties_scored; current.yellow += stat.yellow_cards; current.red += stat.red_cards;
    totals.set(stat.player_id, current);
  }
  const rows: ClubPlayerRow[] = (players ?? []).map((player) => ({
    id: player.id,
    name: `${player.first_name?.[0] ? `${player.first_name[0]}. ` : ""}${player.last_name}`,
    position: posLetter[player.position as keyof typeof posLetter] ?? "—",
    order: positionOrder[player.position as keyof typeof positionOrder] ?? 9,
    value: Number(player.marketfoot_value),
    ...(totals.get(player.id) ?? empty()),
  }));
  const names = new Map((clubs ?? []).map((item) => [item.id, item.name]));
  const shorts = new Map((clubs ?? []).map((item) => [item.id, item.short_name || item.name]));
  const fixtures: ClubFixture[] = (matches ?? []).filter((match) => one(match.matchdays)?.season_id === season?.id).map((match) => {
    const day = one(match.matchdays)!;
    return {
      id: match.id,
      matchdayId: day.id,
      day: day.number,
      kickoff: match.kickoff_at,
      home: { id: match.home_club_id, name: names.get(match.home_club_id) ?? "—", short: shorts.get(match.home_club_id) ?? "—", score: match.home_score },
      away: { id: match.away_club_id, name: names.get(match.away_club_id) ?? "—", short: shorts.get(match.away_club_id) ?? "—", score: match.away_score },
      postponed: Boolean(match.is_postponed),
    };
  });
  return { club, rows, fixtures };
}
