import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type RankingRow = { gamerId: string; username: string; rank: number; totalWealth: number; squadValue: number; budget: number; lockedAccount: number; earnings: number };

export async function getLatestRankings(): Promise<RankingRow[]> {
  const supabase = createSupabaseAdminClient();
  const { data: snapshots } = await supabase.from("ranking_leaderboard").select("settlement_id,gamer_id,general_rank,total_wealth,squad_value,budget,locked_account,cumulative_earnings,created_at").order("created_at", { ascending: false }).limit(500);
  const settlementId = snapshots?.[0]?.settlement_id; if (!settlementId) return [];
  const rows = snapshots?.filter((item) => item.settlement_id === settlementId) ?? [];
  const ids = rows.map((row) => row.gamer_id);
  const { data: profiles } = await supabase.from("profiles").select("id,username").in("id", ids);
  const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.username]));
  return rows.map((row) => ({ gamerId: row.gamer_id, username: names.get(row.gamer_id) ?? "Joueur", rank: row.general_rank, totalWealth: Number(row.total_wealth), squadValue: Number(row.squad_value), budget: Number(row.budget), lockedAccount: Number(row.locked_account), earnings: Number(row.cumulative_earnings) })).sort((a, b) => a.rank - b.rank);
}
