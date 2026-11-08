import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { one } from "@/lib/supabase/relation";
import type { HofCategory, HofGroup, HofRecord, HofScope } from "@/components/hall-of-fame/hall-of-fame";

type Entry = { key: string; name: string; period: string; amount: number; gamerId?: string };

/** "J22 - 24/25": matchday number and the short form of the season name ("2024/2025" -> "24/25"). */
function periodLabel(number: number | null, season: string): string {
  const years = season.match(/(\d{2,4})\D+(\d{2,4})/);
  const short = years ? `${years[1].slice(-2)}/${years[2].slice(-2)}` : season;
  return number === null ? short : `J${number} - ${short}`;
}

async function managerGains(scope: HofScope): Promise<Entry[]> {
  const db = createSupabaseAdminClient();
  const { data } = await db
    .from("settlement_gamer_effects")
    .select("gamer_id,gross_effect,profiles(username),matchday_settlements!inner(status,matchdays(number,seasons(name)))")
    .is("reversed_at", null)
    .eq("matchday_settlements.status", "completed")
    .limit(20000);
  const totals = new Map<string, Entry>();
  for (const row of data ?? []) {
    const settlement = one(row.matchday_settlements);
    const day = one(settlement?.matchdays);
    const season = one(day?.seasons)?.name ?? "";
    const number = scope === "day" ? day?.number ?? 0 : null;
    const key = `${row.gamer_id}:${season}:${number}`;
    const entry = totals.get(key) ?? { key, gamerId: row.gamer_id, name: one(row.profiles)?.username ?? "Joueur", period: periodLabel(number, season), amount: 0 };
    entry.amount += Number(row.gross_effect);
    totals.set(key, entry);
  }
  return [...totals.values()];
}

async function playerGains(scope: HofScope): Promise<Entry[]> {
  const db = createSupabaseAdminClient();
  const { data } = await db
    .from("settlement_player_effects")
    .select("player_id,normal_effect,players(first_name,last_name),matchday_settlements:settlement_id!inner(status,matchdays(number,seasons(name)))")
    .is("reversed_at", null)
    .eq("matchday_settlements.status", "completed")
    .limit(50000);
  const totals = new Map<string, Entry>();
  for (const row of data ?? []) {
    const settlement = one(row.matchday_settlements);
    const day = one(settlement?.matchdays);
    const season = one(day?.seasons)?.name ?? "";
    const number = scope === "day" ? day?.number ?? 0 : null;
    const key = `${row.player_id}:${season}:${number}`;
    const player = one(row.players);
    const entry = totals.get(key) ?? { key, name: `${player?.first_name?.[0] ?? ""}. ${player?.last_name ?? ""}`.trim(), period: periodLabel(number, season), amount: 0 };
    entry.amount += Number(row.normal_effect);
    totals.set(key, entry);
  }
  return [...totals.values()];
}

type Settlement = { status?: string; matchdays?: { number: number; seasons?: { name: string } | { name: string }[] | null } | { number: number; seasons?: { name: string } | { name: string }[] | null }[] | null };

/** Executed Mercato orders per (player, matchday/season): purchases and sales counts. */
async function mercatoVolumes(kind: "bought" | "sold", scope: HofScope): Promise<Entry[]> {
  const db = createSupabaseAdminClient();
  const column = kind === "bought" ? "bought_player_id" : "sold_player_id";
  const { data } = await db.from("mercado_orders").select(`${column},players:${column}(first_name,last_name),matchdays(number,seasons(name))`).eq("status", "executed").limit(50000);
  const totals = new Map<string, Entry>();
  for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
    const day = one(row.matchdays as Settlement["matchdays"]);
    const season = one(day?.seasons)?.name ?? "";
    const number = scope === "day" ? day?.number ?? 0 : null;
    const playerId = String(row[column]);
    const key = `${playerId}:${season}:${number}`;
    const player = one(row.players as { first_name: string | null; last_name: string } | { first_name: string | null; last_name: string }[] | null);
    const entry = totals.get(key) ?? { key, name: `${player?.first_name?.[0] ? `${player.first_name[0]}. ` : ""}${player?.last_name ?? ""}`.trim(), period: periodLabel(number, season), amount: 0 };
    entry.amount += 1;
    totals.set(key, entry);
  }
  return [...totals.values()];
}

/** Realised buy/sell capital gains per manager: sale price minus the value the sold player was acquired at. */
async function managerCapitalGains(scope: HofScope): Promise<Entry[]> {
  const db = createSupabaseAdminClient();
  const [{ data: direct }, { data: orders }] = await Promise.all([
    db.from("direct_transfers").select("squad_id,sold_player_id,sold_value,matchdays(number,seasons(name)),squads(gamer_id,profiles(username))").eq("status", "completed").limit(20000),
    db.from("mercado_orders").select("squad_id,sold_player_id,submitted_sold_value,matchdays(number,seasons(name)),squads(gamer_id,profiles(username))").eq("status", "executed").limit(20000),
  ]);
  const { data: snaps } = await db.from("matchday_squad_snapshots").select("squad_id,player_id,acquired_value,created:frozen_at").order("frozen_at", { ascending: false }).limit(50000);
  const acquired = new Map<string, number>();
  for (const snap of snaps ?? []) { const key = `${snap.squad_id}:${snap.player_id}`; if (!acquired.has(key)) acquired.set(key, Number(snap.acquired_value)); }
  type Row = { squad_id: string; sold_player_id: string; sold_value?: number | string; submitted_sold_value?: number | string; matchdays: Settlement["matchdays"]; squads: unknown };
  const totals = new Map<string, Entry>();
  for (const row of [...(direct ?? []), ...(orders ?? [])] as unknown as Row[]) {
    const base = acquired.get(`${row.squad_id}:${row.sold_player_id}`);
    if (base === undefined) continue;
    const day = one(row.matchdays);
    const season = one(day?.seasons)?.name ?? "";
    const number = scope === "day" ? day?.number ?? 0 : null;
    const squad = one(row.squads as { gamer_id: string; profiles: { username: string } | { username: string }[] | null } | { gamer_id: string; profiles: { username: string } | { username: string }[] | null }[] | null);
    const key = `${squad?.gamer_id}:${season}:${number}`;
    const entry = totals.get(key) ?? { key, gamerId: squad?.gamer_id, name: one(squad?.profiles)?.username ?? "Joueur", period: periodLabel(number, season), amount: 0 };
    entry.amount += Number(row.sold_value ?? row.submitted_sold_value) - base;
    totals.set(key, entry);
  }
  return [...totals.values()];
}

/**
 * Records for one Hall of Fame category. Bench primes are not stored by the settlement engine yet, so that category
 * stays empty (the page explains why); every other category is aggregated from recorded settlements and transfers.
 */
export async function getHallOfFame(group: HofGroup, category: HofCategory, scope: HofScope, userId?: string): Promise<HofRecord[]> {
  let entries: Entry[] = [];
  let unit: "money" | "achats" | "ventes" = "money";
  if (group === "managers" && category === "perfs") entries = await managerGains(scope);
  else if (group === "managers" && category === "mercato") entries = await managerCapitalGains(scope);
  else if (group === "joueurs" && category === "perfs") entries = await playerGains(scope);
  else if (group === "joueurs" && category === "achats") { entries = await mercatoVolumes("bought", scope); unit = "achats"; }
  else if (group === "joueurs" && category === "ventes") { entries = await mercatoVolumes("sold", scope); unit = "ventes"; }
  const ranked = entries.filter((entry) => entry.amount > 0).sort((a, b) => b.amount - a.amount || a.key.localeCompare(b.key));
  const toRecord = (entry: Entry, index: number): HofRecord => ({
    rank: index + 1, name: entry.name, period: entry.period, amount: entry.amount, isMe: Boolean(userId && entry.gamerId === userId),
    label: unit === "money" ? undefined : `${entry.amount} ${unit === "achats" ? (entry.amount > 1 ? "achats" : "achat") : entry.amount > 1 ? "ventes" : "vente"}`,
  });
  const top = ranked.slice(0, 10).map(toRecord);
  if (userId && !top.some((record) => record.isMe)) {
    const index = ranked.findIndex((entry) => entry.gamerId === userId);
    if (index >= 0) top.push(toRecord(ranked[index], index));
  }
  return top;
}
