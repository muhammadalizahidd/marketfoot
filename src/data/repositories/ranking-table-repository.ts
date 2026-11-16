import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type RankingMetric = "general" | "primes" | "predictions" | "speculation" | "honours" | "bench";
export type RankingPeriod = "all" | "first" | "second" | "day";

export const rankingMetrics: RankingMetric[] = ["general", "primes", "predictions", "speculation", "honours", "bench"];
export const rankingPeriods: RankingPeriod[] = ["all", "first", "second", "day"];

export type RankingTableRow = {
  gamerId: string; username: string; avatarUrl: string | null; clubName: string | null;
  rank: number; delta: number | null;
  totalWealth: number; squadValue: number; budget: number; lockedAccount: number;
  primes: number; latestPrimes: number; speculation: number; transferCount: number;
  benchPrimes: number; latestBench: number; predictions: number; latestPredictions: number;
  honoursPoints: number; bestRank: number | null; top10: number; top20: number; top30: number;
};

export type RankingTableQuery = {
  seasonId: string; metric: RankingMetric; period: RankingPeriod; day: number;
  search: string; page: number; pageSize: number; sort: string; dir: "asc" | "desc"; friendsOnly: boolean;
};

/** Sort keys accepted by `read_ranking_table`; anything else falls back to the rank. */
export const sortKeys = ["rank", "username", "club", "squad_value", "budget", "total_wealth", "primes", "latest_primes", "speculation", "transfer_count", "bench_primes", "latest_bench", "predictions", "latest_predictions", "honours_points", "best_rank", "top10", "top20", "top30"];

type Raw = Record<string, string | number | null>;
const n = (value: string | number | null | undefined) => Number(value ?? 0);

/** One page of a gamer ranking, read as the signed-in gamer (friends filter and "me" depend on the session). */
export async function getRankingTable(query: RankingTableQuery): Promise<{ rows: RankingTableRow[]; total: number; error: boolean }> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("read_ranking_table", {
    p_season: query.seasonId, p_metric: query.metric, p_period: query.period, p_day: query.day, p_search: query.search,
    p_page: query.page, p_page_size: query.pageSize, p_sort: sortKeys.includes(query.sort) ? query.sort : "rank", p_dir: query.dir, p_friends_only: query.friendsOnly,
  });
  if (error) return { rows: [], total: 0, error: true };
  const raw = (data ?? []) as Raw[];
  const rows = raw.map((row): RankingTableRow => ({
    gamerId: String(row.gamer_id), username: String(row.username), avatarUrl: (row.avatar_url as string | null) ?? null, clubName: (row.club_name as string | null) ?? null,
    rank: n(row.rank), delta: row.prev_rank == null ? null : n(row.prev_rank) - n(row.rank),
    totalWealth: n(row.total_wealth), squadValue: n(row.squad_value), budget: n(row.budget), lockedAccount: n(row.locked_account),
    primes: n(row.primes), latestPrimes: n(row.latest_primes), speculation: n(row.speculation), transferCount: n(row.transfer_count),
    benchPrimes: n(row.bench_primes), latestBench: n(row.latest_bench), predictions: n(row.predictions), latestPredictions: n(row.latest_predictions),
    honoursPoints: n(row.honours_points), bestRank: row.best_rank == null ? null : n(row.best_rank), top10: n(row.top10), top20: n(row.top20), top30: n(row.top30),
  }));
  return { rows, total: n(raw[0]?.total_count), error: false };
}
