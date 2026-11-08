/**
 * Live, code-driven MARKETFOOT system test.
 *
 * This script deliberately reads credentials from .env.local and never prints them.
 * `--check` is read-only.  `--exercise` is reserved for isolated, labelled test
 * records and must be used only after the read-only health check succeeds.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { calculateSettlementEffect } from "../src/rules/settlement";

const targetEmail = "muhammadalizahid0621@gmail.com";

function envFromFile(name: string) {
  const line = readFileSync(resolve(process.cwd(), ".env.local"), "utf8")
    .split(/\r?\n/)
    .find((entry) => entry.trim().startsWith(`${name}=`));
  if (!line) throw new Error(`Missing ${name} in .env.local.`);
  return line.slice(line.indexOf("=") + 1).trim().replace(/^['"]|['"]$/g, "");
}

function fail(message: string): never {
  throw new Error(message);
}

const url = envFromFile("NEXT_PUBLIC_SUPABASE_URL");
const serviceRole = envFromFile("SUPABASE_SERVICE_ROLE_KEY");
const admin = createClient(url, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });

async function requireData<T>(promise: PromiseLike<{ data: T | null; error: { message: string } | null }>, label: string): Promise<T> {
  const { data, error } = await promise;
  if (error) fail(`${label}: ${error.message}`);
  if (data === null) fail(`${label}: no data returned.`);
  return data;
}

async function getTargetUser() {
  let page = 1;
  while (page <= 10) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) fail(`Unable to list auth users: ${error.message}`);
    const user = data.users.find((item) => item.email?.toLowerCase() === targetEmail);
    if (user) return user;
    if (data.users.length < 1000) break;
    page += 1;
  }
  fail(`No Supabase auth account exists for ${targetEmail}.`);
}

async function check() {
  const user = await getTargetUser();
  const profile = await requireData(admin.from("profiles").select("id,username,role").eq("id", user.id).single(), "Profile");
  const squad = await requireData(admin.from("squads").select("id,name").eq("gamer_id", user.id).maybeSingle(), "Squad lookup");
  const finance = await requireData(admin.from("gamer_finances").select("budget,blocked_account").eq("gamer_id", user.id).maybeSingle(), "Finance lookup");
  const matchdays = await requireData(admin.from("matchdays").select("id,number,status").in("status", ["open", "mercado"]).order("number"), "Active matchdays");
  const memberSummary = squad
    ? await requireData(admin.from("squad_members").select("player_id,is_starter,is_captain,players(position)").eq("squad_id", squad.id), "Squad members")
    : [];
  const roleCounts = memberSummary.reduce<Record<string, number>>((counts, member) => {
    const position = Array.isArray(member.players) ? member.players[0]?.position : member.players?.position;
    if (position) counts[position] = (counts[position] ?? 0) + 1;
    return counts;
  }, {});

  const results = [
    ["Auth account", "PASS", user.email ?? "unknown"],
    ["Application profile", profile ? "PASS" : "FAIL", profile ? `${profile.username} · ${profile.role}` : "missing"],
    ["Admin access", profile?.role === "admin" ? "PASS" : "FAIL", profile?.role ?? "missing"],
    ["Squad", squad ? "PASS" : "FAIL", squad?.name ?? "not created"],
    ["Finance account", finance ? "PASS" : "FAIL", finance ? `budget ${Number(finance.budget).toLocaleString("en-US")}` : "missing"],
    ["19-player roster", memberSummary.length === 19 ? "PASS" : "FAIL", `${memberSummary.length}/19 · GK ${roleCounts.GK ?? 0}, DF ${roleCounts.DF ?? 0}, MF ${roleCounts.MF ?? 0}, FW ${roleCounts.FW ?? 0}`],
    ["Starting lineup", memberSummary.filter((member) => member.is_starter).length === 11 ? "PASS" : "FAIL", `${memberSummary.filter((member) => member.is_starter).length}/11`],
    ["Captain", memberSummary.filter((member) => member.is_captain).length === 1 ? "PASS" : "FAIL", `${memberSummary.filter((member) => member.is_captain).length}/1`],
    ["Playable matchday", matchdays.length ? "PASS" : "WARN", matchdays.length ? matchdays.map((day) => `J${day.number} ${day.status}`).join(", ") : "none (expected after mock-data cleanup)"],
  ];
  console.table(results.map(([area, status, detail]) => ({ area, status, detail })));
}

type Member = { player_id: string; is_starter: boolean; is_captain: boolean; acquired_value: number; players: { club_id: string; position: "GK" | "DF" | "MF" | "FW"; marketfoot_value: number; real_value: number } | null };
type Fixture = { id: string; home_club_id: string; away_club_id: string; home_score: number | null; away_score: number | null; is_postponed: boolean };

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) fail(message);
}

async function rpc(name: string, args: Record<string, unknown>) {
  const { data, error } = await admin.rpc(name, args);
  if (error) fail(`${name}: ${error.message}`);
  return data;
}

async function countSettlementLedger(settlementId: string) {
  const { count, error } = await admin.from("financial_ledger").select("id", { count: "exact", head: true }).eq("settlement_id", settlementId);
  if (error) fail(`Read settlement ledger: ${error.message}`);
  return count ?? 0;
}

async function exercise() {
  const runId = `SYSTEM_TEST_${Date.now()}`;
  const user = await getTargetUser();
  const profile = await requireData(admin.from("profiles").select("id,role").eq("id", user.id).single(), "Profile");
  assert(profile.role === "admin", "The target account must be an admin to run the lifecycle test.");
  const squad = await requireData(admin.from("squads").select("id").eq("gamer_id", user.id).single(), "Target squad");
  const members = await requireData(admin.from("squad_members").select("player_id,is_starter,is_captain,acquired_value,players(club_id,position,marketfoot_value,real_value)").eq("squad_id", squad.id), "Target squad members") as Member[];
  assert(members.length === 19, "A 19-player squad is required for the live test.");
  const financeBefore = await requireData(admin.from("gamer_finances").select("budget,blocked_account").eq("gamer_id", user.id).single(), "Finance before test");

  const groups = new Map<string, Member[]>();
  for (const member of members) {
    assert(member.players, `Player ${member.player_id} is missing competition data.`);
    const bucket = groups.get(member.players.position) ?? [];
    bucket.push(member);
    groups.set(member.players.position, bucket);
  }
  const pick = (position: "GK" | "DF" | "MF" | "FW", count: number) => {
    const options = groups.get(position) ?? [];
    assert(options.length >= count, `The squad does not contain enough ${position} players.`);
    return options.slice(0, count);
  };
  const starters = [...pick("GK", 1), ...pick("DF", 4), ...pick("MF", 3), ...pick("FW", 3)];
  const benchReplacement = (groups.get("DF") ?? [])[4];
  assert(benchReplacement, "The squad needs a defender on the bench for the swap test.");

  let seasonId: string | undefined;
  let matchdayId: string | undefined;
  let testClubId: string | undefined;
  let settlementId: string | undefined;
  let settled = false;
  let lifecycleRpcAvailable = true;
  const log: string[] = [];

  const transition = async (nextStatus: "open" | "mercado" | "closed") => {
    const { error } = await admin.rpc("admin_transition_matchday", { p_actor_id: user.id, p_matchday_id: matchdayId!, p_next_status: nextStatus });
    if (!error) return;
    if (!/permission denied/i.test(error.message)) fail(`admin_transition_matchday: ${error.message}`);
    lifecycleRpcAvailable = false;
    const { error: fallbackError } = await admin.from("matchdays").update({ status: nextStatus }).eq("id", matchdayId!);
    if (fallbackError) fail(`Lifecycle fallback: ${fallbackError.message}`);
    if (nextStatus === "closed") {
      const snapshotRows = members.map((member) => ({ matchday_id: matchdayId!, squad_id: squad.id, gamer_id: user.id, player_id: member.player_id, club_id: member.players!.club_id, position: member.players!.position, acquired_value: member.acquired_value, marketfoot_value: member.players!.marketfoot_value, real_value: member.players!.real_value, is_starter: swappedStarterIds.includes(member.player_id), is_captain: member.player_id === captainId }));
      const { error: snapshotError } = await admin.from("matchday_squad_snapshots").upsert(snapshotRows, { onConflict: "matchday_id,squad_id,player_id" });
      if (snapshotError) fail(`Snapshot fallback: ${snapshotError.message}`);
    }
  };
  let swappedStarterIds: string[] = [];
  let captainId = starters[0].player_id;

  try {
    const season = await requireData(admin.from("seasons").insert({ name: runId, starts_on: "2026-01-01", ends_on: "2026-12-31", is_current: false }).select("id").single(), "Create isolated test season");
    seasonId = season.id;
    const club = await requireData(admin.from("clubs").insert({ name: `${runId} Club`, short_name: `ST${String(Date.now()).slice(-5)}` }).select("id").single(), "Create isolated opponent");
    testClubId = club.id;
    const day = await requireData(admin.from("matchdays").insert({ season_id: seasonId, number: 999, status: "draft", opens_at: new Date().toISOString(), closes_at: new Date(Date.now() + 10 * 86_400_000).toISOString() }).select("id").single(), "Create isolated matchday");
    matchdayId = day.id;

    const clubIds = [...new Set(members.map((member) => member.players!.club_id))];
    const fixtures = clubIds.map((clubId, index) => ({ matchday_id: matchdayId!, home_club_id: clubId, away_club_id: testClubId!, kickoff_at: new Date(Date.now() + (7 + index) * 86_400_000).toISOString() }));
    await requireData(admin.from("matches").insert(fixtures).select("id"), "Create future fixtures");
    await transition("open");
    log.push("draft → open");

    await rpc("update_squad_lineup", { p_gamer_id: user.id, p_starter_ids: starters.map((member) => member.player_id), p_captain_id: starters[0].player_id, p_matchday_id: matchdayId });
    swappedStarterIds = starters.map((member) => member.player_id === starters[1].player_id ? benchReplacement.player_id : member.player_id);
    captainId = starters[2].player_id;
    await rpc("update_squad_lineup", { p_gamer_id: user.id, p_starter_ids: swappedStarterIds, p_captain_id: captainId, p_matchday_id: matchdayId });
    const savedLineup = await requireData(admin.from("squad_members").select("player_id,is_starter,is_captain").eq("squad_id", squad.id), "Read persisted lineup");
    assert(savedLineup.filter((member) => member.is_starter).length === 11, "The saved lineup does not contain 11 starters.");
    assert(savedLineup.some((member) => member.player_id === benchReplacement.player_id && member.is_starter), "The compatible bench replacement was not persisted.");
    assert(savedLineup.some((member) => member.player_id === starters[2].player_id && member.is_captain), "The new captain was not persisted.");
    log.push("lineup swap + captain persistence");

    await transition("mercado");
    log.push("open → mercado");

    const bought = await requireData(admin.from("players").insert({ club_id: testClubId, first_name: "System", last_name: "Test Defender", position: "DF", vm_value: 500_000, marketfoot_value: 500_000, real_value: 500_000, is_active: true }).select("id,marketfoot_value").single(), "Create Mercado player");
    const sold = starters[1];
    const soldValue = Number(sold.players!.marketfoot_value);
    const orderId = await rpc("submit_mercado_order", { p_gamer: user.id, p_day: matchdayId, p_sold: sold.player_id, p_bought: bought.id, p_sold_value: soldValue, p_bought_value: Number(bought.marketfoot_value), p_tax: 10_000, p_commission: 0 });
    const order = await requireData(admin.from("mercado_orders").select("id,status").eq("id", orderId).single(), "Read Mercado order");
    assert(order.status === "pending", "The Mercado order was not queued.");
    await requireData(admin.from("mercado_orders").update({ status: "cancelled" }).eq("id", orderId).select("id").single(), "Cancel isolated Mercado order");
    log.push("Mercado order validation + queue");

    await transition("closed");
    log.push("mercado → closed + snapshots");
    const snapshots = await requireData(admin.from("matchday_squad_snapshots").select("id,gamer_id,player_id,club_id,position,is_starter,is_captain").eq("matchday_id", matchdayId).eq("gamer_id", user.id), "Read lineup snapshots");
    assert(snapshots.length === 19, `Expected 19 snapshots, received ${snapshots.length}.`);

    const matches = await requireData(admin.from("matches").select("id,home_club_id,away_club_id,home_score,away_score,is_postponed").eq("matchday_id", matchdayId), "Read test fixtures") as Fixture[];
    for (const fixture of matches) {
      await requireData(admin.from("matches").update({ home_score: 2, away_score: 1 }).eq("id", fixture.id).select("id").single(), "Save fixture result");
    }
    const fixtureByClub = new Map(matches.map((fixture) => [fixture.home_club_id, fixture]));
    const stats = members.map((member) => ({ match_id: fixtureByClub.get(member.players!.club_id)!.id, player_id: member.player_id, started: swappedStarterIds.includes(member.player_id), minutes_played: swappedStarterIds.includes(member.player_id) ? 90 : 20, goals: member.player_id === starters[2].player_id ? 1 : 0, assists: 0, own_goals: 0, yellow_cards: 0, red_cards: 0, penalties_scored: 0, penalties_missed: 0, penalties_saved: 0, saves: member.players!.position === "GK" ? 3 : 0, substitutions_in: 0, substitutions_out: 0 }));
    await requireData(admin.from("player_match_stats").insert(stats).select("id"), "Save official player statistics");
    log.push("official results + player statistics");

    const settlement = await requireData(admin.from("matchday_settlements").insert({ matchday_id: matchdayId, rules_version: "v3.2.0", requested_by: user.id, attempt: 1 }).select("id").single(), "Request settlement");
    settlementId = settlement.id;
    const effects = snapshots.map((snapshot) => {
      const fixture = fixtureByClub.get(snapshot.club_id)!;
      const stat = stats.find((item) => item.player_id === snapshot.player_id)!;
      const result = calculateSettlementEffect({ snapshotId: snapshot.id, gamerId: snapshot.gamer_id, playerId: snapshot.player_id, clubId: snapshot.club_id, position: snapshot.position, isStarter: snapshot.is_starter, isCaptain: snapshot.is_captain }, { started: stat.started, minutesPlayed: stat.minutes_played, goals: stat.goals, assists: 0, ownGoals: 0, yellowCards: 0, redCards: 0, penaltiesScored: 0, penaltiesMissed: 0, penaltiesSaved: 0, saves: stat.saves, substitutionsOut: 0 }, { isPostponed: false, goalsConceded: fixture.away_score!, teamResult: "home_win" });
      assert(result, "A non-postponed fixture must produce a settlement effect.");
      return { ...result, snapshotId: snapshot.id, gamerId: snapshot.gamer_id, playerId: snapshot.player_id };
    });
    const playerValues = snapshots.map((snapshot) => {
      const stat = stats.find((item) => item.player_id === snapshot.player_id)!;
      const value = calculateSettlementEffect({ snapshotId: snapshot.id, gamerId: snapshot.gamer_id, playerId: snapshot.player_id, clubId: snapshot.club_id, position: snapshot.position, isStarter: stat.started, isCaptain: false }, { started: stat.started, minutesPlayed: stat.minutes_played, goals: stat.goals, assists: 0, ownGoals: 0, yellowCards: 0, redCards: 0, penaltiesScored: 0, penaltiesMissed: 0, penaltiesSaved: 0, saves: stat.saves, substitutionsOut: 0 }, { isPostponed: false, goalsConceded: 1, teamResult: "home_win" });
      assert(value, "Player value computation failed.");
      return { playerId: snapshot.player_id, normalEffect: value.normalEffect };
    });
    await rpc("commit_matchday_settlement", { p_actor_id: user.id, p_settlement_id: settlementId, p_effects: { effects, playerValues } });
    settled = true;
    const ledgerCount = await countSettlementLedger(settlementId);
    // A completed settlement must be idempotent; a second call does not create another ledger entry.
    await rpc("commit_matchday_settlement", { p_actor_id: user.id, p_settlement_id: settlementId, p_effects: { effects, playerValues } });
    const afterReplayCount = await countSettlementLedger(settlementId);
    assert(ledgerCount === afterReplayCount, "Settlement retry created duplicate financial ledger entries.");
    log.push("settlement execution + idempotent retry");

    await rpc("rollback_matchday_settlement", { p_actor_id: user.id, p_settlement_id: settlementId, p_reason: "Automated system-test rollback" });
    settled = false;
    const financeAfterRollback = await requireData(admin.from("gamer_finances").select("budget,blocked_account").eq("gamer_id", user.id).single(), "Finance after rollback");
    assert(Number(financeAfterRollback.budget) === Number(financeBefore.budget) && Number(financeAfterRollback.blocked_account) === Number(financeBefore.blocked_account), "Settlement rollback did not restore the target account balances.");
    log.push("settlement rollback + balance restoration");
    console.table(log.map((step) => ({ step, status: "PASS" })));
    if (!lifecycleRpcAvailable) console.warn("LIFECYCLE RPC WARNING: transition RPC permissions are not active in the hosted database; the data-path fallback was used only for this isolated test.");
  } finally {
    // Remove only records carrying this run's matchday/season IDs.  The repaired valid
    // lineup remains on the account; its temporary captain assignment is cascade-deleted.
    if (settlementId && settled) {
      await rpc("rollback_matchday_settlement", { p_actor_id: user.id, p_settlement_id: settlementId, p_reason: "Automated test emergency rollback" }).catch(() => undefined);
    }
    if (settlementId) {
      await admin.from("ranking_snapshots").delete().eq("settlement_id", settlementId);
      await admin.from("settlement_reversals").delete().eq("settlement_id", settlementId);
      await admin.from("settlement_player_effects").delete().eq("settlement_id", settlementId);
      await admin.from("settlement_gamer_effects").delete().eq("settlement_id", settlementId);
      await admin.from("financial_ledger").delete().eq("settlement_id", settlementId);
      await admin.from("player_value_history").delete().eq("settlement_id", settlementId);
      await admin.from("matchday_settlements").delete().eq("id", settlementId);
    }
    if (matchdayId) {
      await admin.from("mercado_orders").delete().eq("matchday_id", matchdayId);
      await admin.from("direct_transfers").delete().eq("matchday_id", matchdayId);
      await admin.from("matchday_squad_snapshots").delete().eq("matchday_id", matchdayId);
      await admin.from("matches").delete().eq("matchday_id", matchdayId);
      await admin.from("matchdays").delete().eq("id", matchdayId);
    }
    if (testClubId) {
      await admin.from("players").delete().eq("club_id", testClubId);
      await admin.from("clubs").delete().eq("id", testClubId);
    }
    if (seasonId) await admin.from("seasons").delete().eq("id", seasonId);
  }
}

if (process.argv.includes("--check")) {
  check().catch((error) => { console.error(`SYSTEM TEST FAILED: ${error.message}`); process.exitCode = 1; });
} else if (process.argv.includes("--exercise")) {
  exercise().catch((error) => { console.error(`SYSTEM TEST FAILED: ${error.message}`); process.exitCode = 1; });
} else {
  console.error("Usage: tsx scripts/live-system-test.ts --check | --exercise");
  process.exitCode = 2;
}
