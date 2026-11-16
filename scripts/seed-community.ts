/**
 * Community seed for the hosted TEST project: 23 labelled managers (seed.NN@marketfoot.test) so that Classements,
 * Hall of Fame, friends, honours and the sidebar have a realistic population. Runs on top of `qa-seed.ts`
 * (it reuses the QA season, its settled matchdays and its player statistics) and is idempotent.
 *
 *   npx tsx scripts/qa-seed.ts && npx tsx scripts/seed-community.ts
 *   npx tsx scripts/seed-community.ts --reset     removes only what this script created
 *
 * Per manager: profile (generated SVG picture, favourite club), 18-player squad through the production RPC,
 * snapshots + starter/bench gains + ranking snapshot for each settled matchday, prediction results, one or two
 * direct transfers, executed Mercato orders, past-season honours and friendships. Passwords are random and not stored.
 * Money on `gamer_finances` is left at its initial value: only the settled-matchday reports carry the gains.
 */
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { validateDirectTransfer } from "../src/rules";

const env = (name: string) => readFileSync(".env.local", "utf8").split(/\r?\n/).find((l) => l.startsWith(`${name}=`))!.slice(name.length + 1).trim().replace(/^['"]|['"]$/g, "");
const url = env("NEXT_PUBLIC_SUPABASE_URL");
const db = createClient(url, env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
const SEASON = "QA Season 2026/2027";
const DOMAIN = "@marketfoot.test";
const NAMES = ["Petarmouillé", "Zizou-mercato", "Flo-Cash93", "Jilou89", "Passedédela", "Kiffeur1893", "Palluuul", "OusmaneBO", "Oscarrrito", "Francas67", "Trutlejkshuu", "Ligue1Addict", "TacleGlissé", "CornerKing", "MbappéFan7", "LeCholismo", "SortiDuFrigo", "CaviarEnStock", "FergieTime90", "TurpinLeJuge", "ClubDesCinq", "Mercato_Max", "Banc2Touche"];

const ok = async <T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>, label: string): Promise<T> => {
  const { data, error } = await p;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data as T;
};
let seed = 20261115;
const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
const between = (min: number, max: number) => Math.round(min + rnd() * (max - min));
const pick = <T,>(items: T[]) => items[Math.floor(rnd() * items.length)];
const shuffle = <T,>(items: T[]) => items.map((item) => [rnd(), item] as const).sort((a, b) => a[0] - b[0]).map(([, item]) => item);

/** A small head-and-shoulders portrait on a coloured background; the manager's initial is kept as the accessible label. */
function avatarSvg(name: string) {
  const hues = [210, 25, 150, 280, 340, 45, 190, 100];
  const hue = hues[Math.abs([...name].reduce((s, c) => s + c.charCodeAt(0), 0)) % hues.length];
  const skin = ["#f1c9a5", "#d9a273", "#a8724a", "#7a4b2d", "#f6d9bf"][name.length % 5];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" fill="hsl(${hue} 70% 62%)"/><path d="M16 128c4-28 24-40 48-40s44 12 48 40z" fill="hsl(${(hue + 40) % 360} 45% 28%)"/><circle cx="64" cy="54" r="24" fill="${skin}"/><path d="M40 52c0-18 12-26 24-26s24 8 24 26c-6-8-14-12-24-12s-18 4-24 12z" fill="hsl(${(hue + 200) % 360} 30% 18%)"/></svg>`;
}

async function allSeedUsers() {
  const found: { id: string; email: string }[] = [];
  for (let page = 1; page <= 20; page++) {
    const { data } = await db.auth.admin.listUsers({ page, perPage: 200 });
    for (const u of data.users) if (u.email?.startsWith("seed.") && u.email.endsWith(DOMAIN)) found.push({ id: u.id, email: u.email });
    if (data.users.length < 200) break;
  }
  return found;
}

async function reset() {
  const users = await allSeedUsers();
  const ids = users.map((u) => u.id);
  if (ids.length) {
    const { data: squads } = await db.from("squads").select("id").in("gamer_id", ids);
    const squadIds = (squads ?? []).map((s) => s.id);
    for (const t of ["settlement_player_effects", "settlement_gamer_effects", "ranking_snapshots", "prediction_results", "matchday_squad_snapshots", "financial_ledger", "gamer_honours"]) await db.from(t).delete().in("gamer_id", ids);
    await db.from("friendships").delete().in("follower_id", ids);
    await db.from("friendships").delete().in("followed_id", ids);
    if (squadIds.length) {
      for (const t of ["direct_transfers", "mercado_orders", "squad_members", "captain_assignments"]) await db.from(t).delete().in("squad_id", squadIds);
      await db.from("squads").delete().in("id", squadIds);
    }
    await db.from("gamer_finances").delete().in("gamer_id", ids);
    for (const u of users) await db.auth.admin.deleteUser(u.id);
  }
  console.log(`Removed ${users.length} seeded managers.`);
}

async function main() {
  if (process.argv.includes("--reset")) return reset();

  const season = await ok(db.from("seasons").select("id").eq("name", SEASON).maybeSingle(), "QA season (run scripts/qa-seed.ts first)");
  if (!season) throw new Error(`Season "${SEASON}" not found: run scripts/qa-seed.ts first.`);
  const days = await ok(db.from("matchdays").select("id,number,status").eq("season_id", season.id).order("number"), "matchdays");
  const settled = days.filter((d) => d.status === "settled");
  const open = days.find((d) => d.status === "open");
  const settlements = await ok(db.from("matchday_settlements").select("id,matchday_id").in("matchday_id", settled.map((d) => d.id)), "settlements");
  const settlementOf = new Map(settlements.map((s) => [s.matchday_id, s.id]));
  const clubs = await ok(db.from("clubs").select("id,name"), "clubs");
  const players = await ok(db.from("players").select("id,club_id,position,marketfoot_value,real_value").eq("is_active", true), "players");
  const qa = (await db.from("profiles").select("id").eq("username", "QA_Claude").maybeSingle()).data;

  // 1. Managers
  const existing = new Map((await allSeedUsers()).map((u) => [u.email, u.id]));
  const managers: { id: string; username: string }[] = [];
  for (const [index, username] of NAMES.entries()) {
    const email = `seed.${String(index + 1).padStart(2, "0")}${DOMAIN}`;
    let id = existing.get(email);
    if (!id) {
      const { data, error } = await db.auth.admin.createUser({ email, password: randomBytes(14).toString("base64url") + "!9a", email_confirm: true, user_metadata: { username } });
      if (error) throw new Error(`createUser ${username}: ${error.message}`);
      id = data.user.id;
    }
    const path = `seed/${username.replace(/[^A-Za-z0-9]/g, "_")}.svg`;
    await db.storage.from("avatars").upload(path, Buffer.from(avatarSvg(username)), { contentType: "image/svg+xml", upsert: true });
    const avatar = db.storage.from("avatars").getPublicUrl(path).data.publicUrl;
    await db.from("profiles").update({ username, avatar_url: avatar, favorite_club_id: pick(clubs).id, bio: "Compte de démonstration." }).eq("id", id);
    managers.push({ id, username });
  }
  if (qa) {
    const path = "seed/QA_Claude.svg";
    await db.storage.from("avatars").upload(path, Buffer.from(avatarSvg("QA_Claude")), { contentType: "image/svg+xml", upsert: true });
    await db.from("profiles").update({ avatar_url: db.storage.from("avatars").getPublicUrl(path).data.publicUrl, favorite_club_id: clubs.find((c) => /paris|psg/i.test(c.name))?.id ?? clubs[0].id }).eq("id", qa.id);
  }

  // 2. Squads, snapshots, gains, predictions
  for (const manager of managers) {
    const { count } = await db.from("squads").select("id", { count: "exact", head: true }).eq("gamer_id", manager.id);
    if (!count) {
      const { data: fin } = await db.from("gamer_finances").select("budget").eq("gamer_id", manager.id).single();
      const budget = Number(fin!.budget);
      let chosen: typeof players = [];
      for (let attempt = 0; attempt < 400 && !chosen.length; attempt++) {
        const perClub = new Map<string, number>(); const draft: typeof players = [];
        for (const [pos, n] of [["GK", 3], ["DF", 6], ["MF", 5], ["FW", 5]] as const) {
          for (const p of shuffle(players.filter((x) => x.position === pos))) { if (draft.filter((c) => c.position === pos).length >= n) break; if ((perClub.get(p.club_id) ?? 0) >= 4) continue; draft.push(p); perClub.set(p.club_id, (perClub.get(p.club_id) ?? 0) + 1); }
        }
        if (draft.reduce((s, p) => s + Number(p.marketfoot_value), 0) <= budget) chosen = draft;
      }
      if (!chosen.length) throw new Error(`No affordable squad found for ${manager.username}`);
      await ok(db.rpc("create_initial_squad", { p_gamer_id: manager.id, p_name: manager.username, p_members: chosen.map((p) => ({ playerId: p.id, acquiredValue: Number(p.marketfoot_value) })), p_budget: budget }), `squad ${manager.username}`);
    }
  }
  const strength = new Map(managers.map((m) => [m.id, 0.4 + rnd() * 1.6])); // a manager's general level, so rankings are stable but not identical
  for (const manager of managers) {
    const squad = await ok(db.from("squads").select("id,squad_members(players(id,club_id,position,marketfoot_value,real_value))").eq("gamer_id", manager.id).single(), `squad ${manager.username}`);
    type P = { id: string; club_id: string; position: string; marketfoot_value: number; real_value: number };
    const members = (squad.squad_members as unknown as { players: P | P[] }[]).map((m) => (Array.isArray(m.players) ? m.players[0] : m.players));
    const starters = [["GK", 1], ["DF", 4], ["MF", 3], ["FW", 3]].flatMap(([pos, n]) => members.filter((m) => m.position === pos).slice(0, n as number)).map((m) => m.id);
    const squadValue = members.reduce((s, m) => s + Number(m.marketfoot_value), 0);
    let cumulative = 0;
    for (const day of settled) {
      const settlementId = settlementOf.get(day.id)!;
      const { count: done } = await db.from("ranking_snapshots").select("id", { count: "exact", head: true }).eq("settlement_id", settlementId).eq("gamer_id", manager.id);
      const starterGain = Math.round(between(350_000, 2_600_000) * strength.get(manager.id)! / 1000) * 1000;
      const benchGain = Math.round(between(20_000, 520_000) * rnd() * 2 / 1000) * 1000;
      cumulative += starterGain;
      if (done) continue;
      const snaps = await ok(db.from("matchday_squad_snapshots").insert(members.map((m) => ({ matchday_id: day.id, squad_id: squad.id, gamer_id: manager.id, player_id: m.id, club_id: m.club_id, position: m.position, acquired_value: m.marketfoot_value, marketfoot_value: m.marketfoot_value, real_value: m.real_value, is_starter: starters.includes(m.id), is_captain: m.id === starters[1] }))).select("id,player_id"), "snapshots");
      const effects = snaps.map((s) => {
        const isStarter = starters.includes(s.player_id);
        const amount = isStarter ? starterGain / starters.length : benchGain / (members.length - starters.length);
        return { settlement_id: settlementId, snapshot_id: s.id, player_id: s.player_id, gamer_id: manager.id, normal_effect: amount, captain_adjustment: 0, gamer_effect: amount, calculation: { seed: true } };
      });
      await ok(db.from("settlement_player_effects").insert(effects).select("id"), "player effects");
      await ok(db.from("settlement_gamer_effects").insert({ settlement_id: settlementId, gamer_id: manager.id, gross_effect: starterGain, budget_delta: starterGain * 0.7, locked_account_delta: starterGain * 0.3 }).select("id"), "gamer effect");
      await ok(db.from("ranking_snapshots").insert({ settlement_id: settlementId, matchday_id: day.id, gamer_id: manager.id, total_wealth: squadValue + 2_000_000 + cumulative, squad_value: squadValue, budget: 2_000_000 + cumulative * 0.7, locked_account: cumulative * 0.3, general_rank: 1, earnings_rank: 1 }).select("id"), "ranking");
      const eligible = 9; const correct = between(2, 8); const earnings = Math.round((correct - 4.5) * between(20_000, 90_000));
      await ok(db.from("prediction_results").insert({ settlement_id: settlementId, matchday_id: day.id, gamer_id: manager.id, eligible_matches: eligible, correct_predictions: correct, result_pct: (correct / eligible) * 100, average_pct: 50, x: correct - 4.5, raw_g: earnings, earnings, budget_delta: earnings * 0.7, locked_account_delta: earnings * 0.3 }).select("id"), "prediction");
    }
  }

  // 3. Ranks inside every settled matchday (QA_Claude included), by total wealth and by earnings
  for (const [settlementId] of settlements.map((s) => [s.id] as const)) {
    const rows = await ok(db.from("ranking_snapshots").select("id,gamer_id,total_wealth").eq("settlement_id", settlementId).order("total_wealth", { ascending: false }), "ranking read");
    const earn = await ok(db.from("settlement_gamer_effects").select("gamer_id,gross_effect").eq("settlement_id", settlementId), "earnings read");
    const byEarn = [...earn].sort((a, b) => Number(b.gross_effect) - Number(a.gross_effect)).map((e) => e.gamer_id);
    for (const [index, row] of rows.entries()) await db.from("ranking_snapshots").update({ general_rank: index + 1, earnings_rank: byEarn.indexOf(row.gamer_id) + 1 || index + 1 }).eq("id", row.id);
  }

  // 4. Transfers (speculation), Mercato orders (Hall of Fame purchases / sales), friendships, honours
  const popular = shuffle(players).slice(0, 14);
  const mercatoDay = settled.at(-1);
  // A trigger only accepts Mercato orders on a matchday whose Mercato is open: open it for the inserts, then restore its status.
  if (mercatoDay) await db.from("matchdays").update({ status: "mercado" }).eq("id", mercatoDay.id);
  for (const manager of managers) {
    const squad = await ok(db.from("squads").select("id,squad_members(players(id,club_id,position,marketfoot_value))").eq("gamer_id", manager.id).single(), "squad");
    type P = { id: string; club_id: string; position: string; marketfoot_value: number };
    const members = (squad.squad_members as unknown as { players: P | P[] }[]).map((m) => (Array.isArray(m.players) ? m.players[0] : m.players));
    const owned = new Set(members.map((m) => m.id));
    const { count: made } = await db.from("direct_transfers").select("id", { count: "exact", head: true }).eq("squad_id", squad.id);
    if (!made && open && rnd() < 0.75) {
      for (const pos of shuffle(["FW", "MF", "DF"]).slice(0, between(1, 2))) {
        const out = members.filter((m) => m.position === pos)[0];
        const incoming = shuffle(players.filter((p) => p.position === pos && !owned.has(p.id) && p.club_id !== out.club_id))[0];
        if (!out || !incoming) continue;
        const { data: fin } = await db.from("gamer_finances").select("budget").eq("gamer_id", manager.id).single();
        const { count } = await db.from("direct_transfers").select("id", { count: "exact", head: true }).eq("squad_id", squad.id);
        const decision = validateDirectTransfer({ budget: Number(fin!.budget), soldValue: Number(out.marketfoot_value), boughtValue: Number(incoming.marketfoot_value), matchday: open.number, transfersAlreadyMade: count ?? 0 });
        if (!decision.ok) continue;
        const { error } = await db.rpc("complete_direct_transfer", { p_gamer_id: manager.id, p_matchday_id: open.id, p_sold_player_id: out.id, p_bought_player_id: incoming.id, p_sold_value: Number(out.marketfoot_value), p_bought_value: Number(incoming.marketfoot_value), p_tax: decision.value.tax, p_resulting_budget: decision.value.resultingBudget });
        if (!error) owned.add(incoming.id);
      }
    }
    const { count: orders } = await db.from("mercado_orders").select("id", { count: "exact", head: true }).eq("squad_id", squad.id);
    if (!orders && mercatoDay) {
      const rows = shuffle(members).slice(0, between(1, 3)).flatMap((out) => {
        const inn = pick(popular.filter((p) => p.position === out.position && !owned.has(p.id)));
        return inn ? [{ squad_id: squad.id, matchday_id: mercatoDay.id, sold_player_id: out.id, bought_player_id: inn.id, submitted_sold_value: Number(out.marketfoot_value), submitted_bought_value: Number(inn.marketfoot_value), submitted_tax: 0, fixed_commission: 0, status: "executed" }] : [];
      });
      if (rows.length) { const { error } = await db.from("mercado_orders").insert(rows); if (error) console.log(`Mercato orders for ${manager.username}: ${error.message}`); }
    }
  }
  if (mercatoDay) await db.from("matchdays").update({ status: mercatoDay.status }).eq("id", mercatoDay.id);
  if (qa) await db.from("friendships").upsert(shuffle(managers).slice(0, 8).map((m) => ({ follower_id: qa.id, followed_id: m.id })), { onConflict: "follower_id,followed_id" });
  await db.from("friendships").upsert(managers.flatMap((m, i) => [managers[(i + 1) % managers.length], managers[(i + 5) % managers.length]].map((f) => ({ follower_id: m.id, followed_id: f.id }))), { onConflict: "follower_id,followed_id" });

  const { error: awardError } = await db.rpc("award_season_honours", { p_season: season.id });
  if (awardError) console.log(`Current-season honours skipped: ${awardError.message}`);
  const { data: past } = await db.from("seasons").select("id").neq("id", season.id).limit(2);
  const { count: pastCount } = await db.from("gamer_honours").select("id", { count: "exact", head: true }).in("gamer_id", managers.map((m) => m.id)).neq("season_id", season.id);
  if (!pastCount && past?.length) {
    const points = (category: string, rank: number) => (category === "overall" ? (rank <= 10 ? 150 : rank <= 20 ? 100 : 60) : category === "first_half" ? 5 : category === "primes" ? (rank <= 20 ? 25 : 20) : rank <= 30 ? 8 : 4);
    const rows = shuffle(managers).slice(0, 14).flatMap((m) => past.flatMap((s) => ["overall", "primes", "predictions"].map((category) => { const rank = between(1, 40); return { gamer_id: m.id, season_id: s.id, category, rank, points: points(category, rank) }; })));
    const { error } = await db.from("gamer_honours").insert(rows);
    if (error) console.log(`Past honours skipped: ${error.message}`);
  }
  console.log(`Community seed ready: ${managers.length} managers on "${SEASON}".`);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
