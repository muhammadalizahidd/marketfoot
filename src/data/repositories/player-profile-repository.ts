import { ensureRulesSettings } from "@/services/rules-settings";
import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { one } from "@/lib/supabase/relation";
import { clubCode } from "@/lib/club-codes";
import { explainPlayerMatchEffect, teamResultEffects, teamResultOf, type EarningLine, type PlayerMatchInput } from "@/rules";

export type MatchRow = {
  day: number;
  kickoff: string;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  /** Result from the player's club point of view. */
  result: "win" | "draw" | "loss";
  minutes: number;
  started: boolean;
  substitutedOut: boolean;
  played: boolean;
  goals: number;
  assists: number;
  cleanSheet: boolean;
  yellow: number;
  red: number;
  ownGoals: number;
  total: number;
  lines: EarningLine[];
};
export type ActivityEvent = { id: string; at: string; kind: "achat" | "vente" | "mercato" | "primes"; label: string; impact: number; value: number };
export type PlayerProfile = {
  id: string;
  firstName: string;
  lastName: string;
  position: "GK" | "DF" | "MF" | "FW";
  club: { id: string; name: string; short: string; code: string };
  value: number;
  initialValue: number;
  changePct: number;
  form: ("V" | "N" | "D")[];
  holders: number;
  owned: { acquiredValue: number; acquiredAt: string } | null;
  primes: number;
  mercatoSincePurchase: number;
  mercatoTotal: number;
  mercatoLast: number;
  perf: { played: number; started: number; notPlayed: number; goals: number; penalties: number; assists: number; yellow: number; red: number };
  market: { buys: number; sells: number; todayBuys: number; todaySells: number };
  chart: { day: number; amount: number }[];
  rows: MatchRow[];
};

type Matchday = { number: number; season_id: string };
type Fixture = { id: string; kickoff_at: string; home_club_id: string; away_club_id: string; home_score: number | null; away_score: number | null; is_postponed: boolean; matchdays: Matchday | Matchday[] | null };

const startOfParisDay = () => {
  const now = new Date();
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const offset = (new Date(now.toLocaleString("en-US", { timeZone: "Europe/Paris" })).getTime() - new Date(now.toLocaleString("en-US", { timeZone: "UTC" })).getTime()) / 60000;
  return new Date(new Date(`${day}T00:00:00Z`).getTime() - offset * 60000);
};

export async function getPlayerProfile(playerId: string, userId?: string): Promise<PlayerProfile | null> {
  await ensureRulesSettings();
  if (!/^[0-9a-f-]{36}$/i.test(playerId)) return null;
  const db = createSupabaseAdminClient();
  const { data: player } = await db.from("players").select("id,first_name,last_name,position,club_id,marketfoot_value,clubs(id,name,short_name)").eq("id", playerId).maybeSingle();
  if (!player) return null;
  const club = one(player.clubs);
  const clubId = player.club_id as string;
  const { data: season } = await db.from("seasons").select("id").order("is_current", { ascending: false }).order("starts_on", { ascending: false }).limit(1).maybeSingle();
  const since = startOfParisDay().toISOString();
  const [{ data: history }, { data: stats }, { data: fixtures }, { data: clubs }, { count: holders }, owned, { data: boughtDirect }, { data: soldDirect }, { data: boughtOrders }, { data: soldOrders }] = await Promise.all([
    db.from("player_value_history").select("id,value_kind,reason,previous_value,next_value,created_at").eq("player_id", playerId).order("created_at"),
    db.from("player_match_stats").select("match_id,started,minutes_played,goals,assists,own_goals,yellow_cards,red_cards,penalties_scored,penalties_missed,penalties_saved,saves,substitutions_out").eq("player_id", playerId),
    db.from("matches").select("id,kickoff_at,home_club_id,away_club_id,home_score,away_score,is_postponed,matchdays!inner(number,season_id)").or(`home_club_id.eq.${clubId},away_club_id.eq.${clubId}`).order("kickoff_at"),
    db.from("clubs").select("id,name,short_name"),
    db.from("squad_members").select("player_id", { count: "exact", head: true }).eq("player_id", playerId),
    userId ? db.from("squad_members").select("acquired_value,acquired_at,squads!inner(gamer_id)").eq("player_id", playerId).eq("squads.gamer_id", userId).maybeSingle() : Promise.resolve({ data: null }),
    db.from("direct_transfers").select("created_at").eq("bought_player_id", playerId).eq("status", "completed"),
    db.from("direct_transfers").select("created_at").eq("sold_player_id", playerId).eq("status", "completed"),
    db.from("mercado_orders").select("updated_at").eq("bought_player_id", playerId).eq("status", "executed"),
    db.from("mercado_orders").select("updated_at").eq("sold_player_id", playerId).eq("status", "executed"),
  ]);
  const shorts = new Map((clubs ?? []).map((item) => [item.id, item.short_name || item.name]));
  const statByMatch = new Map((stats ?? []).map((stat) => [stat.match_id, stat]));
  const ownMatches = ((fixtures ?? []) as unknown as Fixture[]).filter((match) => one(match.matchdays)?.season_id === season?.id && !match.is_postponed && match.home_score !== null && match.away_score !== null);

  const rows: MatchRow[] = ownMatches.map((match) => {
    const isHome = match.home_club_id === clubId;
    const goalsFor = (isHome ? match.home_score : match.away_score)!;
    const goalsAgainst = (isHome ? match.away_score : match.home_score)!;
    const stat = statByMatch.get(match.id);
    const input: PlayerMatchInput = {
      started: stat?.started ?? false, minutesPlayed: stat?.minutes_played ?? 0, goals: stat?.goals ?? 0, assists: stat?.assists ?? 0, ownGoals: stat?.own_goals ?? 0, yellowCards: stat?.yellow_cards ?? 0,
      redCards: stat?.red_cards ?? 0, penaltiesScored: stat?.penalties_scored ?? 0, penaltiesMissed: stat?.penalties_missed ?? 0, penaltiesSaved: stat?.penalties_saved ?? 0, saves: stat?.saves ?? 0,
      substitutionsOut: stat?.substitutions_out ?? 0, goalsConceded: goalsAgainst,
    };
    // Defensive: a stat line with no minutes cannot carry match facts (the rules module rejects it), so ignore them.
    if (input.minutesPlayed === 0) Object.assign(input, { started: false, goals: 0, assists: 0, ownGoals: 0, yellowCards: 0, redCards: 0, penaltiesScored: 0, penaltiesMissed: 0, penaltiesSaved: 0, saves: 0, substitutionsOut: 0 });
    const explained = explainPlayerMatchEffect(player.position, input, teamResultEffects[teamResultOf(isHome, goalsFor, goalsAgainst)]);
    return {
      day: one(match.matchdays)!.number, kickoff: match.kickoff_at, home: shorts.get(match.home_club_id) ?? "—", away: shorts.get(match.away_club_id) ?? "—", homeScore: match.home_score!, awayScore: match.away_score!,
      result: (goalsFor > goalsAgainst ? "win" : goalsFor < goalsAgainst ? "loss" : "draw") as MatchRow["result"], minutes: input.minutesPlayed, started: input.started, substitutedOut: (input.substitutionsOut ?? 0) > 0, played: input.minutesPlayed > 0,
      goals: input.goals, assists: input.assists, cleanSheet: input.minutesPlayed > 0 && goalsAgainst === 0 && (player.position === "GK" || player.position === "DF"), yellow: input.yellowCards, red: input.redCards, ownGoals: input.ownGoals,
      total: explained.total, lines: explained.lines,
    };
  }).sort((a, b) => b.day - a.day);

  const marketRows = (history ?? []).filter((row) => row.value_kind === "marketfoot_value");
  const mercato = marketRows.filter((row) => row.reason === "mercado_demand").map((row) => ({ at: row.created_at as string, delta: Number(row.next_value) - Number(row.previous_value) }));
  const owner = (owned as { data: { acquired_value: number | string; acquired_at: string } | null }).data;
  const initialValue = marketRows.length ? Number(marketRows[0].previous_value) : Number(player.marketfoot_value);
  const value = Number(player.marketfoot_value);
  const lastFive = [...ownMatches].slice(-5).map((match) => {
    const isHome = match.home_club_id === clubId;
    const goalsFor = (isHome ? match.home_score : match.away_score)!;
    const goalsAgainst = (isHome ? match.away_score : match.home_score)!;
    return goalsFor > goalsAgainst ? "V" : goalsFor < goalsAgainst ? "D" : "N";
  }) as ("V" | "N" | "D")[];
  const count = (list: { created_at?: string; updated_at?: string }[] | null, from?: string) => (list ?? []).filter((item) => !from || String(item.created_at ?? item.updated_at) >= from).length;
  const buys = count(boughtDirect) + count(boughtOrders);
  const sells = count(soldDirect) + count(soldOrders);

  return {
    id: player.id, firstName: player.first_name ?? "", lastName: player.last_name, position: player.position, club: { id: clubId, name: club?.name ?? "", short: club?.short_name ?? club?.name ?? "", code: clubCode(club?.name) },
    value, initialValue, changePct: initialValue ? ((value - initialValue) / initialValue) * 100 : 0, form: lastFive, holders: holders ?? 0,
    owned: owner ? { acquiredValue: Number(owner.acquired_value), acquiredAt: owner.acquired_at } : null,
    primes: rows.reduce((sum, row) => sum + row.total, 0),
    mercatoSincePurchase: owner ? mercato.filter((item) => item.at >= owner.acquired_at).reduce((sum, item) => sum + item.delta, 0) : 0,
    mercatoTotal: mercato.reduce((sum, item) => sum + item.delta, 0), mercatoLast: mercato.length ? mercato[mercato.length - 1].delta : 0,
    perf: {
      played: rows.filter((row) => row.played).length, started: rows.filter((row) => row.started && row.played).length, notPlayed: rows.filter((row) => !row.played).length,
      goals: rows.reduce((sum, row) => sum + row.goals, 0), penalties: (stats ?? []).reduce((sum, stat) => sum + stat.penalties_scored, 0), assists: rows.reduce((sum, row) => sum + row.assists, 0),
      yellow: rows.reduce((sum, row) => sum + row.yellow, 0), red: rows.reduce((sum, row) => sum + row.red, 0),
    },
    market: { buys, sells, todayBuys: count(boughtDirect, since) + count(boughtOrders, since), todaySells: count(soldDirect, since) + count(soldOrders, since) },
    chart: [...rows].sort((a, b) => a.day - b.day).map((row) => ({ day: row.day, amount: row.total })),
    rows,
  };
}

/** Chronological ledger of everything that moved a player's value: purchases, sales, Mercato demand and primes. */
export async function getPlayerActivity(playerId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(playerId)) return null;
  const db = createSupabaseAdminClient();
  const { data: player } = await db.from("players").select("id,first_name,last_name,club_id,clubs(name,short_name)").eq("id", playerId).maybeSingle();
  if (!player) return null;
  const { data: history } = await db.from("player_value_history").select("id,value_kind,reason,previous_value,next_value,created_at,matchdays(number)").eq("player_id", playerId).order("created_at", { ascending: false }).limit(500);
  const events: ActivityEvent[] = [];
  for (const row of history ?? []) {
    const kind = row.reason === "direct_purchase" ? "achat" : row.reason === "direct_sale" ? "vente" : row.reason === "mercado_demand" ? "mercato" : row.reason === "matchday_settlement" || row.reason === "settlement_reversal" ? "primes" : null;
    if (!kind || (kind === "primes") !== (row.value_kind === "real_value")) continue;
    const day = one(row.matchdays as { number: number } | { number: number }[] | null)?.number;
    const label = kind === "achat" ? "Achat" : kind === "vente" ? "Vente" : kind === "mercato" ? "Mercato" : row.reason === "settlement_reversal" ? `Annulation primes${day ? ` J${day}` : ""}` : `Primes${day ? ` J${day}` : ""}`;
    events.push({ id: row.id, at: row.created_at, kind, label, impact: Number(row.next_value) - Number(row.previous_value), value: Number(row.next_value) });
  }
  const club = one(player.clubs);
  return { id: player.id as string, firstName: (player.first_name ?? "") as string, lastName: player.last_name as string, clubId: player.club_id as string, clubName: club?.name ?? "", clubShort: club?.short_name ?? club?.name ?? "", events };
}
