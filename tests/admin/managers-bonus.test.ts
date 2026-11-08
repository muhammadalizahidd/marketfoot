import test from "node:test";
import assert from "node:assert/strict";
import type { PGlite } from "@electric-sql/pglite";
import { ADMIN, GAMER, GAMER2, bootDb, seedWorld } from "../helpers/db";

let db: PGlite; let w: Awaited<ReturnType<typeof seedWorld>>;
test.before(async () => { db = await bootDb(); w = await seedWorld(db); });
const fails = (sql: string, params: unknown[], code: RegExp) => assert.rejects(() => db.query(sql, params as never), code);
const finance = async (id = GAMER) => (await w.q<{ budget: string; blocked_account: string }>("select budget,blocked_account from gamer_finances where gamer_id=$1", [id]))[0];

test("manager list: search, status, signup date, KPIs and linked accounts", async () => {
  await db.query("update profiles set banned_at=now() where id=$1", [GAMER2]);
  await db.query("update auth.users set last_sign_in_at=now()-interval '90 days' where id=$1", [GAMER]);
  await db.query("update profiles set last_seen_at=now()-interval '90 days' where id=$1", [GAMER]);
  const all = await w.q<{ username: string; status: string; email: string; total: string }>("select username,status,email,total from public.admin_managers('', '', null, 10, 0)");
  assert.equal(all.length, 2, "admins are not managers");
  assert.deepEqual(Object.fromEntries(all.map((m) => [m.username, m.status])), { GamerTest: "inactive", GamerTwo: "banned" });
  assert.equal(Number(all[0].total), 2);
  assert.equal((await w.q("select 1 from public.admin_managers('gamertw', '', null, 10, 0)")).length, 1, "search by username");
  assert.equal((await w.q("select 1 from public.admin_managers('gamer@test', '', null, 10, 0)")).length, 1, "search by e-mail");
  assert.equal((await w.q("select 1 from public.admin_managers('', 'banned', null, 10, 0)")).length, 1, "status filter");
  assert.equal((await w.q("select 1 from public.admin_managers('', '', current_date + 1, 10, 0)")).length, 0, "signup date filter");
  assert.equal((await w.q("select 1 from public.admin_managers('', '', null, 1, 1)")).length, 1, "pagination");
  await db.query("insert into profile_ip_events(gamer_id,ip_hash) values($1,'h1'),($2,'h1'),($2,'h2')", [GAMER, GAMER2]);
  const linked = await w.q<{ username: string; linked: number }>("select username,linked from public.admin_managers('', '', null, 10, 0)");
  assert.deepEqual(Object.fromEntries(linked.map((m) => [m.username, m.linked])), { GamerTest: 1, GamerTwo: 1 });
  const [k] = await w.q<{ total: string; new_this_week: string; online: string }>("select * from public.admin_manager_kpis()");
  assert.equal(Number(k.total), 2); assert.equal(Number(k.new_this_week), 2); assert.equal(Number(k.online), 0);
});

test("finance correction: ledger entry, reason required, Blocked Account never negative, admin only", async () => {
  const before = await finance();
  await db.query("select public.admin_adjust_finance($1,$2,-500000,250000,'Erreur de saisie')", [ADMIN, GAMER]);
  const after = await finance();
  assert.equal(Number(after.budget), Number(before.budget) - 500000);
  assert.equal(Number(after.blocked_account), Number(before.blocked_account) + 250000);
  const [entry] = await w.q<{ budget_delta: string; locked_account_delta: string }>("select budget_delta,locked_account_delta from financial_ledger where event_type='admin_correction'");
  assert.equal(Number(entry.budget_delta), -500000); assert.equal(Number(entry.locked_account_delta), 250000);
  await fails("select public.admin_adjust_finance($1,$2,1,0,'  ')", [ADMIN, GAMER], /REASON_REQUIRED/);
  await fails("select public.admin_adjust_finance($1,$2,0,-999999999,'trop')", [ADMIN, GAMER], /./);
  await fails("select public.admin_adjust_finance($1,$2,1,0,'x')", [GAMER, GAMER], /ADMIN_REQUIRED/);
  assert.equal(Number((await finance()).budget), Number(after.budget), "failed corrections change nothing");
});

test("account reset empties the squad, restores the initial budget, keeps the Blocked Account and allows a rebuild", async () => {
  await db.query("update gamer_finances set blocked_account=1234567 where gamer_id=$1", [GAMER]);
  await db.query("insert into captain_assignments(squad_id,matchday_id,player_id) values($1,$2,$3)", [w.squadId, w.day, w.squad[0].id]);
  await fails("select public.admin_reset_manager($1,$2)", [GAMER, GAMER], /ADMIN_REQUIRED/);
  await fails("select public.admin_reset_manager($1,$2)", [ADMIN, ADMIN], /CANNOT_RESET_ADMIN/);
  await db.query("select public.admin_reset_manager($1,$2)", [ADMIN, GAMER]);
  assert.equal((await w.q("select 1 from squad_members where squad_id=$1", [w.squadId])).length, 0, "squad emptied");
  assert.equal((await w.q("select 1 from captain_assignments where squad_id=$1", [w.squadId])).length, 0);
  const f = await finance();
  assert.equal(Number(f.blocked_account), 1234567, "the Blocked Account is kept");
  const initial = Number((await w.q<{ v: string }>("select public.initial_budget_value() v"))[0].v);
  assert.ok(Math.abs(Number(f.budget) - initial) < 0.01, "budget back to the initial value");
  const [p] = await w.q<{ reset_at: string | null }>("select reset_at from profiles where id=$1", [GAMER]);
  assert.ok(p.reset_at);
  const members = JSON.stringify(w.squad.map((x) => ({ playerId: x.id, acquiredValue: 1000000 })));
  await db.query("select create_initial_squad($1,'Squad B',$2::jsonb,$3)", [GAMER, members, f.budget]);
  const [s] = await w.q<{ id: string; name: string }>("select id,name from squads where gamer_id=$1", [GAMER]);
  assert.equal(s.id, w.squadId, "the same squad row is re-used");
  assert.equal(s.name, "Squad B");
  await fails("select create_initial_squad($1,'Squad C',$2::jsonb,$3)", [GAMER, members, f.budget], /SQUAD_ALREADY_EXISTS/);
});

test("bonus plays: lock 2 h before the first match, season maximum, change and withdraw, settled plays are final", async () => {
  await fails("select public.play_bonus($1,$2,'turpin',2)", [GAMER2, w.day], /NO_SQUAD/);
  await db.query("insert into matches(matchday_id,home_club_id,away_club_id,kickoff_at) values($1,$2,$3,now()+interval '1 hour')", [w.day, w.clubs[0], w.clubs[1]]);
  await fails("select public.play_bonus($1,$2,'turpin',2)", [GAMER, w.day], /BONUS_LOCKED/);
  await db.query("update matches set kickoff_at=now()+interval '5 hours' where matchday_id=$1", [w.day]);
  await db.query("select public.play_bonus($1,$2,'turpin',2)", [GAMER, w.day]);
  await db.query("select public.play_bonus($1,$2,'cholismo',2)", [GAMER, w.day]);
  const plays = await w.q<{ bonus_id: string }>("select bonus_id from bonus_plays where squad_id=$1", [w.squadId]);
  assert.deepEqual(plays.map((p) => p.bonus_id), ["cholismo"], "one bonus per matchday: the second pick replaces the first");
  await db.query("select public.unplay_bonus($1,$2)", [GAMER, w.day]);
  assert.equal((await w.q("select 1 from bonus_plays where squad_id=$1", [w.squadId])).length, 0, "bonus withdrawn");

  for (const n of [2, 3]) {
    const d = (await w.q<{ id: string }>("insert into matchdays(season_id,number,status) values($1,$2,'settled') returning id", [w.season, n]))[0].id;
    await db.query("insert into bonus_plays(squad_id,matchday_id,season_id,bonus_id,succeeded,bonus_amount) values($1,$2,$3,'turpin',true,100)", [w.squadId, d, w.season]);
  }
  await fails("select public.play_bonus($1,$2,'turpin',2)", [GAMER, w.day], /BONUS_EXHAUSTED/);
  await db.query("select public.play_bonus($1,$2,'fergie-time',2)", [GAMER, w.day]);
  await db.query("update bonus_plays set succeeded=false where matchday_id=$1", [w.day]);
  await db.query("select public.play_bonus($1,$2,'cholismo',2)", [GAMER, w.day]);
  await db.query("select public.unplay_bonus($1,$2)", [GAMER, w.day]);
  const [kept] = await w.q<{ bonus_id: string }>("select bonus_id from bonus_plays where matchday_id=$1", [w.day]);
  assert.equal(kept.bonus_id, "fergie-time", "settled plays are immutable");
  await db.query("update matchdays set status='draft' where id=$1", [w.day]);
  await fails("select public.play_bonus($1,$2,'cholismo',2)", [GAMER, w.day], /BONUS_CLOSED/);
});
