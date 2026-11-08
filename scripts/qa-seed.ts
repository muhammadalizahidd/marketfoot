/**
 * QA fixture for the hosted test project: one labelled test gamer with a complete squad, plus a labelled
 * "QA Season" (current) with matchdays, matches, player statistics, settled gains and two direct transfers, so
 * that Hall of Fame, club profile, player catalogue and the sidebar can be verified against real rows.
 *
 *   npx tsx scripts/qa-seed.ts          create (idempotent)
 *   npx tsx scripts/qa-seed.ts --reset  remove everything this script created
 *
 * Credentials are written to .figma-cache/qa-credentials.json (never printed, never committed).
 */
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { validateDirectTransfer } from "../src/rules";

const env = (name: string) => readFileSync(".env.local", "utf8").split(/\r?\n/).find((l) => l.startsWith(`${name}=`))!.slice(name.length + 1).trim().replace(/^['"]|['"]$/g, "");
const db = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
const EMAIL = "qa.claude@marketfoot.test";
const USERNAME = "QA_Claude";
const SEASON = "QA Season 2026/2027";
const CREDS = ".figma-cache/qa-credentials.json";

const ok = async <T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>, label: string): Promise<T> => {
  const { data, error } = await p;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data as T;
};
let seed = 7;
const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;

async function findUser() {
  for (let page = 1; page <= 10; page++) {
    const { data } = await db.auth.admin.listUsers({ page, perPage: 200 });
    const hit = data.users.find((u) => u.email === EMAIL);
    if (hit) return hit;
    if (data.users.length < 200) break;
  }
  return null;
}

async function reset() {
  const user = await findUser();
  const { data: season } = await db.from("seasons").select("id").eq("name", SEASON).maybeSingle();
  if (user) { await db.from("gamer_honours").delete().eq("gamer_id", user.id); await db.from("friendships").delete().eq("follower_id", user.id); }
  if (season) {
    await db.from("gamer_honours").delete().eq("season_id", season.id);
    const { data: days } = await db.from("matchdays").select("id").eq("season_id", season.id);
    const dayIds = (days ?? []).map((d) => d.id);
    if (dayIds.length) {
      const { data: sets } = await db.from("matchday_settlements").select("id").in("matchday_id", dayIds);
      const setIds = (sets ?? []).map((s) => s.id);
      if (setIds.length) {
        for (const t of ["ranking_snapshots", "settlement_player_effects", "settlement_gamer_effects", "player_value_history"]) await db.from(t).delete().in("settlement_id", setIds);
        await db.from("financial_ledger").delete().in("idempotency_key", setIds.map((id) => `qa-settlement:${id}`));
        await db.from("matchday_settlements").delete().in("id", setIds);
      }
      await db.from("matchday_squad_snapshots").delete().in("matchday_id", dayIds);
      await db.from("direct_transfers").delete().in("matchday_id", dayIds);
      await db.from("mercado_orders").delete().in("matchday_id", dayIds);
      const { data: ms } = await db.from("matches").select("id").in("matchday_id", dayIds);
      const mIds = (ms ?? []).map((m) => m.id);
      if (mIds.length) await db.from("player_match_stats").delete().in("match_id", mIds);
      await db.from("matches").delete().in("matchday_id", dayIds);
      await db.from("matchdays").delete().in("id", dayIds);
    }
    await db.from("seasons").delete().eq("id", season.id);
  }
  if (user) {
    const { data: squad } = await db.from("squads").select("id").eq("gamer_id", user.id).maybeSingle();
    if (squad) { await db.from("squad_members").delete().eq("squad_id", squad.id); await db.from("captain_assignments").delete().eq("squad_id", squad.id); await db.from("squads").delete().eq("id", squad.id); }
    await db.from("financial_ledger").delete().eq("gamer_id", user.id);
    await db.from("gamer_finances").delete().eq("gamer_id", user.id);
    await db.auth.admin.deleteUser(user.id);
  }
  console.log("QA data removed.");
}

async function main() {
  if (process.argv.includes("--reset")) return reset();

  // 1. User (profile + finances come from the sign-up triggers)
  let user = await findUser();
  if (!existsSync(".figma-cache")) mkdirSync(".figma-cache");
  const password = existsSync(CREDS) ? JSON.parse(readFileSync(CREDS, "utf8")).password : randomBytes(12).toString("base64url") + "!9a";
  if (!user) {
    const { data, error } = await db.auth.admin.createUser({ email: EMAIL, password, email_confirm: true, user_metadata: { username: USERNAME } });
    if (error) throw new Error(`createUser: ${error.message}`);
    user = data.user;
  } else await db.auth.admin.updateUserById(user.id, { password });
  writeFileSync(CREDS, JSON.stringify({ email: EMAIL, password }, null, 2));
  const gamerId = user.id;
  await db.from("profiles").upsert({ id: gamerId, username: USERNAME }, { onConflict: "id" });

  // 2. QA season, matchdays, matches
  let { data: season } = await db.from("seasons").select("id").eq("name", SEASON).maybeSingle();
  if (!season) {
    await db.from("seasons").update({ is_current: false }).eq("is_current", true);
    season = await ok(db.from("seasons").insert({ name: SEASON, starts_on: "2026-08-01", ends_on: "2027-05-31", is_current: true }).select("id").single(), "season");
  }
  const seasonId = season!.id;
  const clubs = await ok(db.from("clubs").select("id,name").order("name"), "clubs");
  const players = await ok(db.from("players").select("id,club_id,first_name,last_name,position,marketfoot_value,real_value").eq("is_active", true), "players");
  let { data: days } = await db.from("matchdays").select("id,number,status").eq("season_id", seasonId).order("number");
  if (!days?.length) {
    const rows = [1, 2, 3, 4].map((number) => ({ season_id: seasonId, number, status: number < 4 ? "settled" : "open", opens_at: `2026-10-${String(number * 7).padStart(2, "0")}T08:00:00Z`, closes_at: number < 4 ? `2026-10-${String(number * 7 + 3).padStart(2, "0")}T20:00:00Z` : "2026-11-14T16:00:00Z" }));
    days = await ok(db.from("matchdays").insert(rows).select("id,number,status").order("number"), "matchdays");
    const ids = clubs.map((c) => c.id);
    const rotate = (round: number) => { const rest = ids.slice(1); const r = [ids[0], ...rest.slice(round % 17), ...rest.slice(0, round % 17)]; return Array.from({ length: 9 }, (_, i) => (round % 2 ? [r[17 - i], r[i]] : [r[i], r[17 - i]])); };
    const kick = ["2026-10-10", "2026-10-17", "2026-10-24", "2026-11-14"];
    const matchRows = days!.flatMap((d, round) => rotate(round).map(([home, away], i) => ({
      matchday_id: d.id, home_club_id: home, away_club_id: away, kickoff_at: `${kick[round]}T${["17:00", "19:00", "19:00", "15:00", "17:00", "19:00", "19:00", "15:00", "20:45"][i]}:00Z`,
      home_score: round < 3 ? Math.floor(rnd() * 4) : null, away_score: round < 3 ? Math.floor(rnd() * 3) : null,
    })));
    const matches = await ok(db.from("matches").insert(matchRows).select("id,matchday_id,home_club_id,away_club_id,home_score,away_score"), "matches");
    // 3. player statistics for the settled matches
    const byClub = new Map<string, typeof players>();
    for (const p of players) byClub.set(p.club_id, [...(byClub.get(p.club_id) ?? []), p].sort((a, b) => Number(b.marketfoot_value) - Number(a.marketfoot_value)));
    const stats: Record<string, unknown>[] = [];
    for (const m of matches.filter((x) => x.home_score !== null)) {
      for (const [club, goals] of [[m.home_club_id, m.home_score!], [m.away_club_id, m.away_score!]] as const) {
        const squad = byClub.get(club) ?? [];
        const attackers = squad.filter((p) => p.position === "FW" || p.position === "MF");
        const scored = new Map<string, number>();
        for (let g = 0; g < goals && attackers.length; g++) { const p = attackers[Math.floor(rnd() * attackers.length)]; scored.set(p.id, (scored.get(p.id) ?? 0) + 1); }
        squad.forEach((p, i) => stats.push({
          match_id: m.id, player_id: p.id, started: i < 4, minutes_played: i < 4 ? 90 : i < 5 ? 25 : 0, goals: scored.get(p.id) ?? 0, assists: rnd() < 0.15 ? 1 : 0, own_goals: rnd() < 0.02 ? 1 : 0,
          yellow_cards: rnd() < 0.18 ? 1 : 0, red_cards: rnd() < 0.02 ? 1 : 0, penalties_scored: 0, saves: p.position === "GK" ? Math.floor(rnd() * 6) : 0,
        }));
      }
    }
    for (let i = 0; i < stats.length; i += 200) await ok(db.from("player_match_stats").insert(stats.slice(i, i + 200)).select("id"), "stats");
  }

  // 4. Squad via the production RPC
  const { data: existing } = await db.from("squads").select("id").eq("gamer_id", gamerId).maybeSingle();
  if (!existing) {
    const { data: fin } = await db.from("gamer_finances").select("budget").eq("gamer_id", gamerId).single();
    const budget = Number(fin!.budget);
    const need: Record<string, number> = { GK: 3, DF: 6, MF: 5, FW: 5 };
    const perClub = new Map<string, number>();
    const chosen: typeof players = [];
    for (const pos of Object.keys(need)) {
      // cheapest valid squad: guarantees the initial budget is never exceeded
      const ordered = players.filter((p) => p.position === pos).sort((a, b) => Number(a.marketfoot_value) - Number(b.marketfoot_value));
      for (const p of ordered) { if (chosen.filter((c) => c.position === pos).length >= need[pos]) break; if ((perClub.get(p.club_id) ?? 0) >= 4) continue; chosen.push(p); perClub.set(p.club_id, (perClub.get(p.club_id) ?? 0) + 1); }
    }
    const cost = chosen.reduce((s, p) => s + Number(p.marketfoot_value), 0);
    if (cost > budget) { chosen.sort((a, b) => Number(a.marketfoot_value) - Number(b.marketfoot_value)); throw new Error(`Squad costs ${cost} but budget is ${budget}`); }
    await ok(db.rpc("create_initial_squad", { p_gamer_id: gamerId, p_name: USERNAME, p_members: chosen.map((p) => ({ playerId: p.id, acquiredValue: Number(p.marketfoot_value) })), p_budget: budget }), "create_initial_squad");
    console.log(`Squad created (${chosen.length} players, cost ${cost}).`);
  }
  const squad = await ok(db.from("squads").select("id,squad_members(player_id,players(id,club_id,position,marketfoot_value,real_value))").eq("gamer_id", gamerId).single(), "squad");
  type Member = { player_id: string; players: { id: string; club_id: string; position: string; marketfoot_value: number; real_value: number } | { id: string; club_id: string; position: string; marketfoot_value: number; real_value: number }[] };
  const members = (squad.squad_members as Member[]).map((m) => ({ ...(Array.isArray(m.players) ? m.players[0] : m.players) }));
  const starters = [["GK", 1], ["DF", 4], ["MF", 3], ["FW", 3]].flatMap(([pos, n]) => members.filter((m) => m.position === pos).slice(0, n as number)).map((m) => m.id);

  // 5. Settled matchdays: snapshots, gains, rankings
  const settled = days!.filter((d) => d.status === "settled");
  const { data: done } = await db.from("matchday_settlements").select("matchday_id").in("matchday_id", settled.map((d) => d.id));
  const gains = [1_240_000, 2_980_000, 1_760_000];
  for (const [i, d] of settled.entries()) {
    if (done?.some((x) => x.matchday_id === d.id)) continue;
    const st = await ok(db.from("matchday_settlements").insert({ matchday_id: d.id, rules_version: "qa-1", status: "completed", requested_by: gamerId, started_at: new Date().toISOString(), completed_at: new Date().toISOString(), attempt: 1 }).select("id").single(), "settlement");
    const snaps = await ok(db.from("matchday_squad_snapshots").insert(members.map((m) => ({ matchday_id: d.id, squad_id: squad.id, gamer_id: gamerId, player_id: m.id, club_id: m.club_id, position: m.position, acquired_value: m.marketfoot_value, marketfoot_value: m.marketfoot_value, real_value: m.real_value, is_starter: starters.includes(m.id), is_captain: m.id === starters[1] }))).select("id,player_id"), "snapshots");
    const each = gains[i] / starters.length;
    await ok(db.from("settlement_player_effects").insert(snaps.filter((s) => starters.includes(s.player_id)).map((s) => ({ settlement_id: st.id, snapshot_id: s.id, player_id: s.player_id, gamer_id: gamerId, normal_effect: each, captain_adjustment: 0, gamer_effect: each, calculation: { qa: true } }))).select("id"), "player effects");
    await ok(db.from("settlement_gamer_effects").insert({ settlement_id: st.id, gamer_id: gamerId, gross_effect: gains[i], budget_delta: gains[i] * 0.7, locked_account_delta: gains[i] * 0.3 }).select("id"), "gamer effect");
    const total = members.reduce((s, m) => s + Number(m.marketfoot_value), 0);
    await ok(db.from("ranking_snapshots").insert({ settlement_id: st.id, matchday_id: d.id, gamer_id: gamerId, total_wealth: total + 2_000_000 + gains.slice(0, i + 1).reduce((a, b) => a + b, 0), squad_value: total, budget: 2_000_000, locked_account: gains.slice(0, i + 1).reduce((a, b) => a + b, 0) * 0.3, general_rank: 1, earnings_rank: 1 }).select("id"), "ranking");
    // value history rows: last settlement prime for a few starters, Mercato move on the last day
    await ok(db.from("player_value_history").insert(starters.slice(0, 6).map((id, k) => ({ player_id: id, matchday_id: d.id, settlement_id: st.id, value_kind: "real_value", previous_value: 5_000_000, next_value: 5_000_000 + (k + 1) * 50_000 * (i + 1), reason: "matchday_settlement" }))).select("id"), "history");
  }

  // 6. Two real direct transfers on the open matchday
  const open = days!.find((d) => d.status === "open")!;
  const { count: made } = await db.from("direct_transfers").select("id", { count: "exact", head: true }).eq("squad_id", squad.id);
  if (!made) {
    const owned = new Set(members.map((m) => m.id));
    for (const pos of ["FW", "MF"]) {
      const out = members.filter((m) => m.position === pos)[0];
      const incoming = players.filter((p) => p.position === pos && !owned.has(p.id) && p.club_id !== out.club_id).sort((a, b) => Math.abs(Number(a.marketfoot_value) - Number(out.marketfoot_value)) - Math.abs(Number(b.marketfoot_value) - Number(out.marketfoot_value)))[0];
      if (!incoming) continue;
      const { data: fin } = await db.from("gamer_finances").select("budget").eq("gamer_id", gamerId).single();
      const { count } = await db.from("direct_transfers").select("id", { count: "exact", head: true }).eq("squad_id", squad.id);
      const decision = validateDirectTransfer({ budget: Number(fin!.budget), soldValue: Number(out.marketfoot_value), boughtValue: Number(incoming.marketfoot_value), matchday: open.number, transfersAlreadyMade: count ?? 0 });
      if (!decision.ok) { console.log(`Transfer skipped: ${decision.message}`); continue; }
      const { error } = await db.rpc("complete_direct_transfer", { p_gamer_id: gamerId, p_matchday_id: open.id, p_sold_player_id: out.id, p_bought_player_id: incoming.id, p_sold_value: Number(out.marketfoot_value), p_bought_value: Number(incoming.marketfoot_value), p_tax: decision.value.tax, p_resulting_budget: decision.value.resultingBudget });
      console.log(error ? `Transfer ${pos} failed: ${error.message}` : `Transfer ${pos} done.`);
    }
  }
  // 7. Executed Mercato orders on the last settled matchday (for the Hall of Fame purchases/sales records)
  const mercatoDay = settled[settled.length - 1];
  const { count: orderCount } = await db.from("mercado_orders").select("id", { count: "exact", head: true }).eq("squad_id", squad.id);
  if (!orderCount && mercatoDay) {
    const owned = new Set(members.map((m) => m.id));
    const pool = players.filter((p) => !owned.has(p.id));
    const pairs = [0, 1, 2, 3].map((i) => ({ out: members[i * 4], inn: pool.find((p, k) => p.position === members[i * 4].position && k % 3 === i)! })).filter((x) => x.inn);
    const rows = pairs.map(({ out, inn }) => ({ squad_id: squad.id, matchday_id: mercatoDay.id, sold_player_id: out.id, bought_player_id: inn.id, submitted_sold_value: Number(out.marketfoot_value), submitted_bought_value: Number(inn.marketfoot_value), submitted_tax: 0, fixed_commission: 0, status: "executed" }));
    const { error } = await db.from("mercado_orders").insert(rows);
    console.log(error ? `Mercato orders skipped: ${error.message}` : `${rows.length} executed Mercato orders added.`);
  }
  // 8. Honours (Palmarès): awarded from the QA season rankings, plus two earlier seasons for the history, and friends
  const { error: awardError } = await db.rpc("award_season_honours", { p_season: seasonId });
  if (awardError) console.log(`Honours award skipped: ${awardError.message}`);
  const { data: others } = await db.from("seasons").select("id,name").neq("id", seasonId).order("name").limit(2);
  const { count: pastCount } = await db.from("gamer_honours").select("id", { count: "exact", head: true }).eq("gamer_id", gamerId).neq("season_id", seasonId);
  if (!pastCount && others?.length) {
    const past = [
      [{ category: "overall", rank: 7 }, { category: "first_half", rank: 3 }, { category: "primes", rank: 19 }, { category: "predictions", rank: 27 }],
      [{ category: "overall", rank: 18 }, { category: "primes", rank: 22 }, { category: "predictions", rank: 64 }],
    ];
    const pts: Record<string, (rank: number) => number> = { overall: (r) => (r <= 10 ? 150 : 100), first_half: () => 5, primes: (r) => (r <= 20 ? 25 : 20), predictions: (r) => (r <= 30 ? 8 : 4) };
    const rows = others.flatMap((o, i) => (past[i] ?? []).map((h) => ({ gamer_id: gamerId, season_id: o.id, category: h.category, rank: h.rank, points: pts[h.category](h.rank) })));
    const { error } = await db.from("gamer_honours").insert(rows);
    if (error) console.log(`Past honours skipped: ${error.message}`);
  }
  const { data: gamers } = await db.from("profiles").select("id").neq("id", gamerId).limit(3);
  if (gamers?.length) await db.from("friendships").upsert(gamers.map((g) => ({ follower_id: gamerId, followed_id: g.id })), { onConflict: "follower_id,followed_id" });
  console.log(`QA ready. Login ${EMAIL} (password in ${CREDS}). Season ${SEASON}.`);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
