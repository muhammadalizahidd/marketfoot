import { ensureRulesSettings } from "@/services/rules-settings";
import "server-only";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { one } from "@/lib/supabase/relation";
import { honoursBand, honoursPoints, trophySlotCount, type HonoursCategory } from "@/rules";

type Rel<T> = T | T[] | null;

export type TileState = { count: number; bestRank: number };
export type HonourLine = { icon: string; label: string };
export type SeasonHonours = { seasonId: string; season: string; overallRank: number | null; points: number; lines: HonourLine[] };
export type Honours = {
  totalPoints: number;
  palmaresRank: number | null;
  trophies: number;
  distinct: number;
  slots: number;
  best: { rank: number; season: string } | null;
  tiles: Record<string, TileState>;
  selected: string | null;
  seasons: SeasonHonours[];
};

const family: Record<HonoursCategory, string> = { overall: "overall", first_half: "first-half", primes: "primes", predictions: "predictions", matchday_primes: "matchday", matchday_predictions: "matchday-pred" };
const categoryLabel: Record<HonoursCategory, (rank: number) => string> = {
  overall: (rank) => `${rank}e au classement général`,
  first_half: (rank) => `${rank}${rank === 1 ? "er" : "e"} de la phase Aller`,
  primes: (rank) => `${rank}e au classement des primes`,
  predictions: (rank) => `${rank}e au classement des pronostics`,
  matchday_primes: (rank) => `${rank}e du badge journée`,
  matchday_predictions: () => "Meilleur pronostiqueur d’une journée",
};

/** Honours (trophies) of one gamer, with their rank in the Palmarès ranking (total honours points). */
export async function getHonours(gamerId: string): Promise<Honours> {
  await ensureRulesSettings();
  const admin = createSupabaseAdminClient();
  const [{ data: rows }, { data: all }, { data: profile }] = await Promise.all([
    admin.from("gamer_honours").select("category,rank,points,seasons(id,name,starts_on)").eq("gamer_id", gamerId),
    admin.from("gamer_honours").select("gamer_id,points").limit(100000),
    admin.from("profiles").select("displayed_trophy").eq("id", gamerId).maybeSingle(),
  ]);
  type Row = { category: HonoursCategory; rank: number; points: number; seasons: Rel<{ id: string; name: string; starts_on: string }> };
  const list = ((rows ?? []) as unknown as Row[]);
  const tiles: Honours["tiles"] = {};
  const seasons = new Map<string, SeasonHonours & { start: string; entries: { category: HonoursCategory; rank: number }[] }>();
  for (const row of list) {
    const band = honoursBand(row.rank);
    if (band) {
      const key = `${row.category}:${band}`;
      const tile = tiles[key] ?? { count: 0, bestRank: row.rank };
      tile.count += 1; tile.bestRank = Math.min(tile.bestRank, row.rank); tiles[key] = tile;
    }
    const season = one(row.seasons);
    if (!season) continue;
    const entry = seasons.get(season.id) ?? { seasonId: season.id, season: season.name, overallRank: null, points: 0, lines: [], start: season.starts_on, entries: [] };
    entry.points += row.points;
    if (row.category === "overall") entry.overallRank = row.rank;
    entry.entries.push({ category: row.category, rank: row.rank });
    seasons.set(season.id, entry);
  }
  const order: HonoursCategory[] = ["first_half", "overall", "primes", "predictions", "matchday_primes", "matchday_predictions"];
  const history = [...seasons.values()].sort((a, b) => b.start.localeCompare(a.start)).map((season) => ({
    seasonId: season.seasonId, season: season.season, overallRank: season.overallRank, points: season.points,
    lines: season.entries.filter((e) => e.category !== "matchday_primes" && e.category !== "matchday_predictions").sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category)).map((e) => ({ icon: `${family[e.category]}-${honoursBand(e.rank) ?? 100}`, label: categoryLabel[e.category](e.rank) })),
  }));
  const totals = new Map<string, number>();
  for (const row of all ?? []) totals.set(row.gamer_id, (totals.get(row.gamer_id) ?? 0) + Number(row.points));
  const mine = totals.get(gamerId) ?? 0;
  const overall = list.filter((row) => row.category === "overall").sort((a, b) => a.rank - b.rank)[0];
  return {
    totalPoints: mine, palmaresRank: mine > 0 ? 1 + [...totals.values()].filter((points) => points > mine).length : null,
    trophies: list.length, distinct: Object.keys(tiles).length, slots: trophySlotCount,
    best: overall ? { rank: overall.rank, season: one(overall.seasons)?.name ?? "" } : null, tiles, selected: profile?.displayed_trophy ?? null, seasons: history,
  };
}

export type FriendRow = {
  gamerId: string; username: string; avatarUrl: string | null; isMe: boolean; rank: number; delta: number | null;
  club: { name: string; code: string } | null; squadValue: number; budget: number; primes: number; latestPrimes: number; honours: number;
};
export type FriendPeriod = "all" | "first" | "second" | "day";

/** Friends of the signed-in gamer (plus themselves), ranked like the general ranking for the chosen period. */
export async function getFriends(ownerId: string, seasonId: string | undefined, period: FriendPeriod, day: number, sort?: string, dir: "asc" | "desc" = "asc"): Promise<{ rows: FriendRow[]; count: number; seasonId: string | null; days: number[] }> {
  const user = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  const { data: links } = await user.from("friendships").select("followed_id").eq("follower_id", ownerId);
  const friendIds = (links ?? []).map((link) => link.followed_id as string);
  const { data: seasons } = await admin.from("seasons").select("id").order("is_current", { ascending: false }).order("starts_on", { ascending: false });
  const season = seasonId ?? seasons?.[0]?.id ?? null;
  if (!season) return { rows: [], count: friendIds.length, seasonId: null, days: [] };
  const { data: days } = await admin.from("matchdays").select("number").eq("season_id", season).order("number");
  const dayNumbers = (days ?? []).map((item) => item.number as number);
  const ids = [ownerId, ...friendIds];
  const { data: profiles } = await admin.from("profiles").select("id,username,avatar_url,clubs:favorite_club_id(name)").in("id", ids);
  const byId = new Map((profiles ?? []).map((p) => [p.id as string, p]));
  const { data: honours } = await admin.from("gamer_honours").select("gamer_id,points").in("gamer_id", ids);
  const points = new Map<string, number>();
  for (const row of honours ?? []) points.set(row.gamer_id, (points.get(row.gamer_id) ?? 0) + Number(row.points));
  type R = { gamer_id: string; rank: number | string; total_wealth: number; squad_value: number; budget: number; earnings: number; latest_earnings: number };
  const read = async (gamerId: string, atDay: number) => {
    const name = byId.get(gamerId)?.username as string | undefined; if (!name) return null;
    const { data } = await user.rpc("read_rankings", { p_season: season, p_metric: "general", p_period: period, p_day: atDay, p_search: name, p_page: 1 });
    return ((data ?? []) as R[]).find((row) => row.gamer_id === gamerId) ?? null;
  };
  const rows = (await Promise.all(ids.map(async (gamerId) => {
    const [now, before] = await Promise.all([read(gamerId, day), day > 1 ? read(gamerId, day - 1) : Promise.resolve(null)]);
    const profile = byId.get(gamerId); if (!profile || !now) return null;
    const club = one(profile.clubs as Rel<{ name: string }>);
    return { gamerId, username: profile.username as string, avatarUrl: (profile.avatar_url as string | null) ?? null, isMe: gamerId === ownerId, rank: Number(now.rank), delta: before ? Number(before.rank) - Number(now.rank) : null,
      club: club ? { name: club.name, code: "" } : null, squadValue: Number(now.squad_value), budget: Number(now.budget), primes: Number(now.earnings), latestPrimes: Number(now.latest_earnings), honours: points.get(gamerId) ?? 0 } as FriendRow;
  }))).filter((row): row is FriendRow => row !== null);
  const key = (["rank", "username", "squadValue", "budget", "primes", "latestPrimes", "honours"] as const).find((item) => item === sort) ?? "rank";
  const sign = dir === "desc" ? -1 : 1;
  rows.sort((a, b) => sign * (typeof a[key] === "string" ? String(a[key]).localeCompare(String(b[key]), "fr") : Number(a[key]) - Number(b[key])));
  return { rows, count: friendIds.length, seasonId: season, days: dayNumbers };
}

export async function getFriendCount(ownerId: string): Promise<number> {
  const user = await createSupabaseServerClient();
  const { count } = await user.from("friendships").select("followed_id", { count: "exact", head: true }).eq("follower_id", ownerId);
  return count ?? 0;
}

export type Settings = { username: string; email: string; emailConfirmed: boolean; avatarUrl: string | null; favoriteClubId: string | null; bio: string; country: string; theme: "light" | "dark" | "auto"; clubs: { id: string; name: string }[] };
export async function getSettings(userId: string, email: string, emailConfirmed: boolean): Promise<Settings | null> {
  const admin = createSupabaseAdminClient();
  const [{ data: profile }, { data: clubs }] = await Promise.all([
    admin.from("profiles").select("username,avatar_url,favorite_club_id,bio,country,theme").eq("id", userId).maybeSingle(),
    admin.from("clubs").select("id,name").order("name"),
  ]);
  if (!profile) return null;
  return { username: profile.username, email, emailConfirmed, avatarUrl: profile.avatar_url, favoriteClubId: profile.favorite_club_id, bio: profile.bio ?? "", country: profile.country ?? "", theme: profile.theme as Settings["theme"], clubs: clubs ?? [] };
}

export { honoursPoints };
