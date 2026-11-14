import "server-only";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { one } from "@/lib/supabase/relation";
import { bonusCatalogue } from "@/lib/bonus-catalogue";

export type RankCard = { label: string; rank: number | null; delta: number | null };
export type TransferLine = { kind: "Mercato" | "Libre"; at: string; sold: string; soldValue: number; bought: string; boughtValue: number; delta: number };
export type PlayerPrime = { position: "GK" | "DF" | "MF" | "FW"; name: string; amount: number };
export type BonusResult = { id: string; title: string; image: string; text: string; /** null while the bonus has not been evaluated. */ succeeded: boolean | null; amount: number | null };
export type HistoryRow = {
  day: number;
  /** Bonus played on this matchday, if any. */
  bonus: BonusResult | null;
  rank: number | null;
  rankDelta: number | null;
  dayRank: number | null;
  starters: number;
  predictions: number;
  total: number;
  trophies: string[];
  transfers: TransferLine[];
  startersDetail: PlayerPrime[];
  benchDetail: PlayerPrime[];
};
export type Performance = {
  username: string;
  seasonName: string;
  days: number[];
  currentDay: number;
  selectedDay: number;
  ranks: RankCard[];
  evolution: { day: number; rank: number }[];
  totalGamers: number;
  value: { squad: number; changePct: number; primes: number; mercato: number; locked: number };
  results: { starters: number; bench: number; predictions: number; total: number };
  history: HistoryRow[];
};

type Ranked = { gamer_id: string; rank: number | string };

/** Rank of one gamer for a metric, read through the signed-in user's session (the ranking RPCs require it). */
async function rankOf(metric: string, season: string, day: number, username: string, gamerId: string): Promise<number | null> {
  const db = await createSupabaseServerClient();
  const { data } = metric === "predictions"
    ? await db.rpc("read_prediction_rankings", { p_season: season, p_period: "all", p_day: day, p_search: username, p_page: 1 })
    : await db.rpc("read_rankings", { p_season: season, p_metric: metric, p_period: "all", p_day: day, p_search: username, p_page: 1 });
  const hit = ((data ?? []) as Ranked[]).find((row) => row.gamer_id === gamerId);
  return hit ? Number(hit.rank) : null;
}

export async function getPerformance(gamerId: string, seasonId?: string, selectedDay?: number): Promise<Performance | null> {
  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin.from("profiles").select("username").eq("id", gamerId).maybeSingle();
  if (!profile) return null;
  const { data: seasons } = await admin.from("seasons").select("id,name,is_current").order("is_current", { ascending: false }).order("starts_on", { ascending: false });
  const season = (seasons ?? []).find((item) => item.id === seasonId) ?? seasons?.[0];
  if (!season) return null;

  const { data: days } = await admin.from("matchdays").select("id,number").eq("season_id", season.id).order("number");
  const dayById = new Map((days ?? []).map((day) => [day.id, day.number as number]));
  const { data: settlements } = await admin.from("matchday_settlements").select("id,matchday_id,completed_at").eq("status", "completed").in("matchday_id", [...dayById.keys()]);
  const settlementDay = new Map((settlements ?? []).map((s) => [s.id, dayById.get(s.matchday_id)!]));
  const settledDays = [...new Set([...settlementDay.values()])].sort((a, b) => a - b);
  const currentDay = settledDays[settledDays.length - 1] ?? 0;
  const day = selectedDay && settledDays.includes(selectedDay) ? selectedDay : currentDay;
  const settlementIds = [...settlementDay.keys()];

  const [{ data: snapshots }, { data: allSnapshots }, { data: effects }, { data: predictions }, { data: playerEffects }, { data: directs }, { data: mercados }, { data: squad }, { data: finance }] = await Promise.all([
    admin.from("ranking_snapshots").select("settlement_id,general_rank,earnings_rank,total_wealth,squad_value,budget,locked_account").eq("gamer_id", gamerId).in("settlement_id", settlementIds),
    admin.from("ranking_snapshots").select("settlement_id,gamer_id").in("settlement_id", settlementIds),
    admin.from("settlement_gamer_effects").select("settlement_id,gamer_id,gross_effect").in("settlement_id", settlementIds).is("reversed_at", null),
    admin.from("prediction_results").select("matchday_id,gamer_id,earnings").in("matchday_id", [...dayById.keys()]),
    admin.from("settlement_player_effects").select("settlement_id,gamer_effect,player_id,matchday_squad_snapshots(is_starter,position),players(first_name,last_name)").eq("gamer_id", gamerId).in("settlement_id", settlementIds).is("reversed_at", null),
    admin.from("direct_transfers").select("created_at,sold_value,bought_value,matchday_id,sold:players!direct_transfers_sold_player_id_fkey(first_name,last_name),bought:players!direct_transfers_bought_player_id_fkey(first_name,last_name),squads!inner(gamer_id)").eq("status", "completed").eq("squads.gamer_id", gamerId),
    admin.from("mercado_orders").select("updated_at,submitted_sold_value,submitted_bought_value,matchday_id,sold:players!mercado_orders_sold_player_id_fkey(first_name,last_name),bought:players!mercado_orders_bought_player_id_fkey(first_name,last_name),squads!inner(gamer_id)").eq("status", "executed").eq("squads.gamer_id", gamerId),
    admin.from("squads").select("id,squad_members(acquired_value)").eq("gamer_id", gamerId).maybeSingle(),
    admin.from("gamer_finances").select("locked_account:blocked_account").eq("gamer_id", gamerId).maybeSingle(),
  ]);

  const { data: bonusPlays } = squad?.id ? await admin.from("bonus_plays").select("matchday_id,bonus_id,succeeded,bonus_amount").eq("squad_id", squad.id).in("matchday_id", [...dayById.keys()]) : { data: [] as { matchday_id: string; bonus_id: string; succeeded: boolean | null; bonus_amount: number | string | null }[] };
  const bonusByDay = new Map<number, BonusResult>();
  for (const play of bonusPlays ?? []) {
    const entry = bonusCatalogue.find((b) => b.id === play.bonus_id); const d = dayById.get(play.matchday_id);
    if (entry && d !== undefined) bonusByDay.set(d, { id: entry.id, title: entry.title, image: entry.image, text: entry.text, succeeded: play.succeeded, amount: play.bonus_amount === null ? null : Number(play.bonus_amount) });
  }

  const snapByDay = new Map((snapshots ?? []).map((s) => [settlementDay.get(s.settlement_id)!, s]));
  const gamersByDay = new Map<number, number>();
  for (const s of allSnapshots ?? []) { const d = settlementDay.get(s.settlement_id)!; gamersByDay.set(d, (gamersByDay.get(d) ?? 0) + 1); }
  const myEffect = new Map<number, number>();
  for (const e of effects ?? []) if (e.gamer_id === gamerId) myEffect.set(settlementDay.get(e.settlement_id)!, Number(e.gross_effect));
  const dayRank = (d: number) => { const mine = myEffect.get(d); if (mine === undefined) return null; return 1 + (effects ?? []).filter((e) => settlementDay.get(e.settlement_id) === d && Number(e.gross_effect) > mine).length; };
  const predByDay = new Map<number, number>();
  for (const p of predictions ?? []) if (p.gamer_id === gamerId) predByDay.set(dayById.get(p.matchday_id)!, (predByDay.get(dayById.get(p.matchday_id)!) ?? 0) + Number(p.earnings));

  type PE = { settlement_id: string; gamer_effect: number | string; matchday_squad_snapshots: { is_starter: boolean; position: PlayerPrime["position"] } | { is_starter: boolean; position: PlayerPrime["position"] }[] | null; players: { first_name: string | null; last_name: string } | { first_name: string | null; last_name: string }[] | null };
  const primesByDay = new Map<number, { starters: PlayerPrime[]; bench: PlayerPrime[]; benchTotal: number }>();
  for (const e of (playerEffects ?? []) as unknown as PE[]) {
    const d = settlementDay.get(e.settlement_id)!; const snap = one(e.matchday_squad_snapshots); const pl = one(e.players);
    const entry = primesByDay.get(d) ?? { starters: [], bench: [], benchTotal: 0 };
    const line = { position: snap?.position ?? "MF", name: `${pl?.first_name?.[0] ? `${pl.first_name[0]}. ` : ""}${pl?.last_name ?? ""}`, amount: Number(e.gamer_effect) } as PlayerPrime;
    if (snap?.is_starter) entry.starters.push(line); else { entry.bench.push(line); entry.benchTotal += line.amount; }
    primesByDay.set(d, entry);
  }

  type TR = { created_at?: string; updated_at?: string; sold_value?: number | string; bought_value?: number | string; submitted_sold_value?: number | string; submitted_bought_value?: number | string; matchday_id: string; sold: { first_name: string | null; last_name: string } | { first_name: string | null; last_name: string }[] | null; bought: { first_name: string | null; last_name: string } | { first_name: string | null; last_name: string }[] | null };
  const nm = (p: { first_name: string | null; last_name: string } | null | undefined) => `${p?.first_name?.[0] ? `${p.first_name[0]}. ` : ""}${p?.last_name ?? ""}`;
  const transfersByDay = new Map<number, TransferLine[]>();
  const pushTransfer = (row: TR, kind: TransferLine["kind"]) => {
    const d = dayById.get(row.matchday_id); if (d === undefined) return;
    const soldValue = Number(row.sold_value ?? row.submitted_sold_value), boughtValue = Number(row.bought_value ?? row.submitted_bought_value);
    transfersByDay.set(d, [...(transfersByDay.get(d) ?? []), { kind, at: String(row.created_at ?? row.updated_at), sold: nm(one(row.sold)), soldValue, bought: nm(one(row.bought)), boughtValue, delta: soldValue - boughtValue }]);
  };
  for (const row of (directs ?? []) as unknown as TR[]) pushTransfer(row, "Libre");
  for (const row of (mercados ?? []) as unknown as TR[]) pushTransfer(row, "Mercato");

  const prev = Math.max(0, day - 1);
  const metrics = [["Classement général", "general"], ["Classement Primes", "gains"], ["Classement Pronostics", "predictions"], ["Classement Banc de touche", "bench"], ["Classement Spéculation", "speculation"]] as const;
  const hasPrev = prev > 0 && settledDays.includes(prev);
  const ranks: RankCard[] = await Promise.all(metrics.map(async ([label, metric]) => {
    const [now, before] = await Promise.all([rankOf(metric, season.id, day, profile.username, gamerId), hasPrev ? rankOf(metric, season.id, prev, profile.username, gamerId) : Promise.resolve(null)]);
    return { label, rank: now, delta: now !== null && before !== null ? before - now : null };
  }));
  ranks.push({ label: "Classement Palmarès", rank: null, delta: null });

  const latest = snapByDay.get(day);
  const acquired = ((squad?.squad_members ?? []) as { acquired_value: number | string }[]).reduce((sum, m) => sum + Number(m.acquired_value), 0);
  const squadValue = Number(latest?.squad_value ?? 0);
  const upTo = (d: number) => [...myEffect.entries()].filter(([k]) => k <= d).reduce((sum, [, v]) => sum + v, 0);
  const mercato = [...transfersByDay.entries()].filter(([k]) => k <= day).flatMap(([, list]) => list).reduce((sum, t) => sum + t.delta, 0);
  const prime = myEffect.get(day) ?? 0, bench = primesByDay.get(day)?.benchTotal ?? 0, pred = predByDay.get(day) ?? 0;

  const history: HistoryRow[] = [...settledDays].reverse().map((d) => {
    const snap = snapByDay.get(d); const before = snapByDay.get(d - 1);
    const det = primesByDay.get(d);
    return {
      day: d, bonus: bonusByDay.get(d) ?? null, rank: snap ? snap.general_rank : null, rankDelta: snap && before ? before.general_rank - snap.general_rank : null, dayRank: dayRank(d),
      starters: myEffect.get(d) ?? 0, predictions: predByDay.get(d) ?? 0, total: (myEffect.get(d) ?? 0) + (predByDay.get(d) ?? 0), trophies: [],
      transfers: (transfersByDay.get(d) ?? []).sort((a, b) => a.at.localeCompare(b.at)), startersDetail: det?.starters ?? [], benchDetail: det?.bench ?? [],
    };
  });

  return {
    username: profile.username, seasonName: season.name, days: settledDays, currentDay, selectedDay: day, ranks,
    evolution: settledDays.map((d) => ({ day: d, rank: snapByDay.get(d)?.general_rank ?? 0 })).filter((p) => p.rank > 0),
    totalGamers: Math.max(1, ...[...gamersByDay.values()]),
    value: { squad: squadValue, changePct: acquired ? ((squadValue - acquired) / acquired) * 100 : 0, primes: upTo(day), mercato, locked: Number(latest?.locked_account ?? finance?.locked_account ?? 0) },
    results: { starters: prime, bench, predictions: pred, total: prime + bench + pred },
    history,
  };
}
