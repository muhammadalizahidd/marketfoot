import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type PlayersView = "general" | "performance" | "speculation";
export type SpeculationPeriod = "all" | "mercato" | "today";
export type PlayersQuery = {
  view: PlayersView;
  period: SpeculationPeriod;
  q?: string;
  position?: string;
  clubs: string[];
  min?: number;
  max?: number;
  sort?: string;
  dir: "asc" | "desc";
  page: number;
  size: number;
};

export type PlayerTableRow = {
  id: string;
  name: string;
  clubId: string;
  clubName: string;
  position: string;
  value: number;
  initialValue: number;
  earnings: number;
  lastEarning: number;
  holders: number;
  lastMercato: number;
  buys: number;
  sells: number;
  matches: number;
  starters: number;
  goals: number;
  assists: number;
  saves: number;
  ownGoals: number;
  penalties: number;
  yellow: number;
  red: number;
};

/** Columns the database view can order by directly; everything else is sorted in memory. */
const viewColumns: Record<string, string> = {
  name: "last_name", value: "marketfoot_value", initialValue: "initial_value", earnings: "earnings", holders: "holders",
  matches: "matches", starters: "starters", goals: "goals", assists: "assists", saves: "saves", penalties: "penalties", yellow: "yellow", red: "red",
};
const memorySorts = new Set(["buys", "sells", "lastMercato", "lastEarning", "ownGoals"]);

type CatalogueRow = {
  id: string; first_name: string | null; last_name: string; position: string; club_id: string; club: string; marketfoot_value: number | string; initial_value: number | string;
  earnings: number | string; holders: number | string; goals: number | string; assists: number | string; penalties: number | string; yellow: number | string; red: number | string;
  saves: number | string; matches: number | string; starters: number | string;
};

const startOfParisDay = () => {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const offsetMinutes = (new Date(now.toLocaleString("en-US", { timeZone: "Europe/Paris" })).getTime() - new Date(now.toLocaleString("en-US", { timeZone: "UTC" })).getTime()) / 60000;
  return new Date(new Date(`${parts}T00:00:00Z`).getTime() - offsetMinutes * 60000);
};

/** Number of purchases / sales per player since a given instant (direct transfers + executed Mercado orders). */
async function transferCounts(since: Date | null) {
  const db = createSupabaseAdminClient();
  let direct = db.from("direct_transfers").select("sold_player_id,bought_player_id").eq("status", "completed");
  let mercado = db.from("mercado_orders").select("sold_player_id,bought_player_id").eq("status", "executed");
  if (since) { direct = direct.gte("created_at", since.toISOString()); mercado = mercado.gte("updated_at", since.toISOString()); }
  const [{ data: a }, { data: b }] = await Promise.all([direct.limit(50000), mercado.limit(50000)]);
  const buys = new Map<string, number>();
  const sells = new Map<string, number>();
  for (const row of [...(a ?? []), ...(b ?? [])]) {
    buys.set(row.bought_player_id, (buys.get(row.bought_player_id) ?? 0) + 1);
    sells.set(row.sold_player_id, (sells.get(row.sold_player_id) ?? 0) + 1);
  }
  return { buys, sells };
}

async function lastMercatoStart(): Promise<Date | null> {
  const db = createSupabaseAdminClient();
  const { data } = await db.from("mercado_runs").select("executed_at").eq("status", "completed").order("executed_at", { ascending: false }).limit(1).maybeSingle();
  return data?.executed_at ? new Date(data.executed_at) : null;
}

/** Latest value deltas (last settlement prime, last Mercato move) and summed own goals for a set of players. */
async function extras(ids: string[]) {
  const db = createSupabaseAdminClient();
  const empty = { lastEarning: new Map<string, number>(), lastMercato: new Map<string, number>(), ownGoals: new Map<string, number>() };
  if (!ids.length) return empty;
  const [{ data: history }, { data: stats }] = await Promise.all([
    db.from("player_value_history").select("player_id,value_kind,reason,previous_value,next_value,created_at").in("player_id", ids).or("and(value_kind.eq.real_value,reason.eq.matchday_settlement),and(value_kind.eq.marketfoot_value,reason.eq.mercado_demand)").order("created_at", { ascending: false }).limit(20000),
    db.from("player_match_stats").select("player_id,own_goals").in("player_id", ids),
  ]);
  for (const row of history ?? []) {
    const delta = Number(row.next_value) - Number(row.previous_value);
    const target = row.reason === "mercado_demand" ? empty.lastMercato : empty.lastEarning;
    if (!target.has(row.player_id)) target.set(row.player_id, delta);
  }
  for (const stat of stats ?? []) empty.ownGoals.set(stat.player_id, (empty.ownGoals.get(stat.player_id) ?? 0) + stat.own_goals);
  return empty;
}

export async function getPlayersTable(filters: PlayersQuery) {
  const db = createSupabaseAdminClient();
  const speculation = filters.view === "speculation";
  const inMemory = speculation || memorySorts.has(filters.sort ?? "");
  const search = filters.q?.trim().replace(/[%_,().]/g, " ").slice(0, 80);
  const select = "id,first_name,last_name,position,club_id,club,marketfoot_value,initial_value,earnings,holders,goals,assists,penalties,yellow,red,saves,matches,starters";
  let query = db.from("player_catalogue").select(select, { count: "exact" }).eq("is_active", true);
  if (search) query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%`);
  if (filters.position && ["GK", "DF", "MF", "FW"].includes(filters.position)) query = query.eq("position", filters.position);
  const clubs = filters.clubs.filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  if (clubs.length) query = query.in("club_id", clubs);
  if (filters.min !== undefined && Number.isFinite(filters.min)) query = query.gte("marketfoot_value", filters.min);
  if (filters.max !== undefined && Number.isFinite(filters.max)) query = query.lte("marketfoot_value", filters.max);
  const column = viewColumns[filters.sort ?? ""] ?? "marketfoot_value";
  const ascending = filters.sort ? filters.dir === "asc" : false;
  query = query.order(column, { ascending }).order("id");
  if (!inMemory) query = query.range((filters.page - 1) * filters.size, filters.page * filters.size - 1);
  else query = query.limit(2000);
  const { data, count, error } = await query;
  if (error) throw new Error("Le catalogue est indisponible. Réessayez.");
  const rows = (data ?? []) as unknown as CatalogueRow[];

  const since = filters.period === "today" ? startOfParisDay() : filters.period === "mercato" ? await lastMercatoStart() : null;
  const [counts, more] = await Promise.all([
    speculation || filters.sort === "buys" || filters.sort === "sells" ? transferCounts(since) : Promise.resolve({ buys: new Map<string, number>(), sells: new Map<string, number>() }),
    extras(rows.map((row) => row.id)),
  ]);

  let table: PlayerTableRow[] = rows.map((row) => ({
    id: row.id,
    name: `${row.first_name?.[0] ? `${row.first_name[0]}. ` : ""}${row.last_name}`,
    clubId: row.club_id,
    clubName: row.club,
    position: row.position,
    value: Number(row.marketfoot_value),
    initialValue: Number(row.initial_value),
    earnings: Number(row.earnings),
    lastEarning: more.lastEarning.get(row.id) ?? 0,
    holders: Number(row.holders),
    lastMercato: more.lastMercato.get(row.id) ?? 0,
    buys: counts.buys.get(row.id) ?? 0,
    sells: counts.sells.get(row.id) ?? 0,
    matches: Number(row.matches), starters: Number(row.starters), goals: Number(row.goals), assists: Number(row.assists), saves: Number(row.saves),
    ownGoals: more.ownGoals.get(row.id) ?? 0, penalties: Number(row.penalties), yellow: Number(row.yellow), red: Number(row.red),
  }));

  let total = count ?? table.length;
  if (inMemory) {
    const key = (filters.sort && filters.sort in (table[0] ?? {}) ? filters.sort : speculation ? "buys" : "value") as keyof PlayerTableRow;
    const sign = filters.sort ? (filters.dir === "asc" ? 1 : -1) : -1;
    table = [...table].sort((a, b) => sign * ((a[key] as number) - (b[key] as number)) || a.name.localeCompare(b.name, "fr"));
    total = table.length;
    table = table.slice((filters.page - 1) * filters.size, filters.page * filters.size);
  }
  return { rows: table, total, page: filters.page, size: filters.size };
}

export async function getClubOptions() {
  const db = createSupabaseAdminClient();
  const [{ data: clubs }, { data: seasons }] = await Promise.all([
    db.from("clubs").select("id,name").order("name"),
    db.from("seasons").select("id,name,is_current").order("starts_on", { ascending: false }),
  ]);
  return { clubs: clubs ?? [], seasons: seasons ?? [] };
}

export type TopMover = { id: string; name: string; clubName: string; delta: number; count: number };

/** Sidebar "Top Achats / Top Ventes": most bought / sold players today, with the value they moved by. */
export async function getTopMovers(): Promise<{ buys: TopMover[]; sells: TopMover[] }> {
  const since = startOfParisDay();
  const { buys, sells } = await transferCounts(since);
  const top = (counts: Map<string, number>) => [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const picked = [...top(buys), ...top(sells)];
  if (!picked.length) return { buys: [], sells: [] };
  const ids = [...new Set(picked.map(([id]) => id))];
  const db = createSupabaseAdminClient();
  const [{ data: players }, { data: history }] = await Promise.all([
    db.from("players").select("id,first_name,last_name,clubs(name)").in("id", ids),
    db.from("player_value_history").select("player_id,previous_value,next_value").eq("value_kind", "marketfoot_value").gte("created_at", since.toISOString()).in("player_id", ids),
  ]);
  const delta = new Map<string, number>();
  for (const row of history ?? []) delta.set(row.player_id, (delta.get(row.player_id) ?? 0) + Number(row.next_value) - Number(row.previous_value));
  const info = new Map((players ?? []).map((p) => {
    const club = Array.isArray(p.clubs) ? p.clubs[0] : p.clubs;
    return [p.id, { name: `${p.first_name?.[0] ? `${p.first_name[0]}. ` : ""}${p.last_name}`, clubName: club?.name ?? "" }];
  }));
  const build = (list: [string, number][]): TopMover[] => list.map(([id, count]) => ({ id, count, delta: delta.get(id) ?? 0, name: info.get(id)?.name ?? "—", clubName: info.get(id)?.clubName ?? "" }));
  return { buys: build(top(buys)), sells: build(top(sells)) };
}
