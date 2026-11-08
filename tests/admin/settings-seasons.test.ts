import test from "node:test";
import assert from "node:assert/strict";
import type { PGlite } from "@electric-sql/pglite";
import { ADMIN, GAMER, bootDb, seedWorld } from "../helpers/db";

let db: PGlite; let w: Awaited<ReturnType<typeof seedWorld>>;
test.before(async () => { db = await bootDb(); w = await seedWorld(db); });
const fails = (sql: string, params: unknown[], code: RegExp) => assert.rejects(() => db.query(sql, params as never), code);

test("honours points follow the active settings and fall back to the PRD table", async () => {
  const [base] = await w.q<{ a: number; b: number }>("select public.honours_points('overall',1) a, public.honours_points('primes',15) b");
  assert.deepEqual([base.a, base.b], [300, 25]);
  await db.query("insert into rules_settings(version,settings,is_active) values(1,'{\"honours\":{\"overall\":{\"1\":999,\"2\":1,\"3\":1,\"10\":1,\"20\":1,\"30\":1,\"50\":1,\"100\":1}}}',true)");
  const [over] = await w.q<{ a: number; b: number }>("select public.honours_points('overall',1) a, public.honours_points('overall',200) b");
  assert.equal(over.a, 999);
  assert.equal(over.b, 0, "ranks beyond 100 earn nothing");
  await db.query("update rules_settings set is_active=false");
  const [back] = await w.q<{ a: number }>("select public.honours_points('overall',1) a");
  assert.equal(back.a, 300);
});

test("the starting budget follows the Barèmes coefficient", async () => {
  const [before] = await w.q<{ v: string }>("select public.initial_budget_value() v");
  await db.query("insert into rules_settings(version,settings,is_active) values(2,'{\"budget\":{\"coefficientInitial\":0.4,\"coefficientMatchday\":0}}',true)");
  const [after] = await w.q<{ v: string }>("select public.initial_budget_value() v");
  assert.ok(Math.abs(Number(after.v) / Number(before.v) - 0.5) < 0.001, "0.4 / 0.8 halves the budget");
  await db.query("update rules_settings set is_active=false");
  await db.query("insert into rules_settings(version,settings,is_active) values(3,'{}',true)");
  await assert.rejects(() => db.query("insert into rules_settings(version,settings,is_active) values(4,'{}',true)"), /duplicate|unique/i);
  await db.query("update rules_settings set is_active=false");
});

test("season lifecycle: activate applies the roster, guards hold, finish records values and honours", async () => {
  // A second season cannot go live while another is active.
  const next = (await w.q<{ id: string }>("insert into seasons(name,starts_on,ends_on,status) values('S2','2027-08-01','2028-06-01','pending_validation') returning id"))[0].id;
  await fails("select public.admin_activate_season($1,$2)", [ADMIN, next], /OTHER_ACTIVE_SEASON/);
  await fails("select public.admin_activate_season($1,$2)", [GAMER, next], /ADMIN_REQUIRED/);

  // Finish S1: end values are recorded from the live catalogue.
  await db.query("update players set marketfoot_value = 2000000 where id=$1", [w.squad[0].id]);
  const [honours] = await w.q<{ n: number }>("select public.admin_finish_season($1,$2) n", [ADMIN, w.season]);
  assert.equal(typeof honours.n, "number");
  const [fin] = await w.q<{ status: string; is_current: boolean }>("select status,is_current from seasons where id=$1", [w.season]);
  assert.deepEqual(fin, { status: "finished", is_current: false });
  const [end] = await w.q<{ end_value: string }>("select end_value from season_players where season_id=$1 and player_id=$1".replace("$1 and player_id=$1", "$1 and player_id=$2"), [w.season, w.squad[0].id]);
  assert.equal(Number(end.end_value), 2000000);
  await fails("select public.admin_finish_season($1,$2)", [ADMIN, w.season], /INVALID_SEASON_STATE/);

  // S2 needs teams before it can be validated.
  await fails("select public.admin_activate_season($1,$2)", [ADMIN, next], /SEASON_NEEDS_TEAMS/);
  await db.query("insert into season_clubs(season_id,club_id) values($1,$2),($1,$3)", [next, w.clubs[0], w.clubs[1]]);
  // Roster: one player moves club with a new value; every other active player drops out of the catalogue.
  await db.query("insert into season_players(season_id,player_id,club_id,start_value) values($1,$2,$3,3500000)", [next, w.spare[0].id, w.clubs[0]]);
  await db.query("select public.admin_activate_season($1,$2)", [ADMIN, next]);
  const [moved] = await w.q<{ club_id: string; marketfoot_value: string; is_active: boolean }>("select club_id,marketfoot_value,is_active from players where id=$1", [w.spare[0].id]);
  assert.equal(moved.club_id, w.clubs[0]); assert.equal(Number(moved.marketfoot_value), 3500000); assert.equal(moved.is_active, true);
  const [dropped] = await w.q<{ is_active: boolean }>("select is_active from players where id=$1", [w.squad[1].id]);
  assert.equal(dropped.is_active, false, "players missing from the roster leave the catalogue");
  const [live] = await w.q<{ status: string; is_current: boolean }>("select status,is_current from seasons where id=$1", [next]);
  assert.deepEqual(live, { status: "active", is_current: true });

  const stats = await w.q<{ season_id: string; teams: number }>("select season_id,teams from public.admin_season_stats()");
  assert.equal(stats.find((s) => s.season_id === next)?.teams, 2);
  assert.equal(stats.find((s) => s.season_id === w.season)?.teams, 6);
});
