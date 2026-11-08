import test from "node:test";
import assert from "node:assert/strict";
import type { PGlite } from "@electric-sql/pglite";
import { ADMIN, GAMER, bootDb, seedWorld } from "../helpers/db";

let db: PGlite; let w: Awaited<ReturnType<typeof seedWorld>>;
test.before(async () => { db = await bootDb(); w = await seedWorld(db); });
const fails = (sql: string, params: unknown[], code: RegExp) => assert.rejects(() => db.query(sql, params as never), code);
const budget = async () => Number((await w.q<{ b: string }>("select budget b from gamer_finances where gamer_id=$1", [GAMER]))[0].b);
const owns = async (id: string) => (await w.q("select 1 from squad_members where squad_id=$1 and player_id=$2", [w.squadId, id])).length === 1;
const value = async (id: string) => Number((await w.q<{ v: string }>("select marketfoot_value v from players where id=$1", [id]))[0].v);
const gk = () => ({ sold: w.squad.find((p) => p.position === "GK")!.id, bought: w.spare.find((p) => p.position === "GK")!.id });

test("a free transfer can be cancelled by an admin and restores squad, budget and values", async () => {
  const { sold, bought } = gk();
  const start = await budget();
  const tax = 100000;
  await db.query("select complete_direct_transfer($1,$2,$3,$4,1000000,1000000,$5,$6)", [GAMER, w.day, sold, bought, tax, start - tax]);
  assert.equal(await owns(sold), false); assert.equal(await owns(bought), true);
  assert.equal(await budget(), start - tax);
  const [t] = await w.q<{ id: string; before_member: { is_initial: boolean }; sale_applied: boolean }>("select id,before_member,sale_applied from direct_transfers");
  assert.equal(t.before_member.is_initial, false, "the replaced member is recorded");
  assert.equal(t.sale_applied, true, "a sale of a non-initial member moves the market");
  assert.equal(await value(sold), 980000, "the seller's value dropped");
  assert.equal(await value(bought), 1020000, "the buyer's demand raised the value");

  await fails("select public.admin_cancel_direct_transfer($1,$2)", [GAMER, t.id], /ADMIN_REQUIRED/);
  await db.query("select public.admin_cancel_direct_transfer($1,$2)", [ADMIN, t.id]);
  assert.equal(await owns(sold), true); assert.equal(await owns(bought), false);
  assert.equal(await budget(), start);
  assert.equal(await value(bought), 1000000);
  assert.equal(await value(sold), 1000000, "the sale effect is reversed too");
  const [status] = await w.q<{ status: string }>("select status from direct_transfers where id=$1", [t.id]);
  assert.equal(status.status, "cancelled");
  const [ledger] = await w.q<{ n: string }>("select count(*) n from financial_ledger where idempotency_key=$1", [`direct-reversal:${t.id}`]);
  assert.equal(Number(ledger.n), 1);
  await fails("select public.admin_cancel_direct_transfer($1,$2)", [ADMIN, t.id], /ALREADY_CANCELLED/);
});

test("a free transfer cannot be cancelled once its matchday is closed", async () => {
  const { sold, bought } = gk();
  const start = await budget();
  await db.query("select complete_direct_transfer($1,$2,$3,$4,1000000,1000000,100000,$5)", [GAMER, w.day, sold, bought, start - 100000]);
  const [t] = await w.q<{ id: string }>("select id from direct_transfers where status='completed'");
  await db.query("update matchdays set status='mercado' where id=$1", [w.day]);
  await db.query("select public.admin_transition_matchday($1,$2,'closed')", [ADMIN, w.day]).catch(() => undefined);
  await db.query("update matchdays set status='closed' where id=$1", [w.day]);
  await fails("select public.admin_cancel_direct_transfer($1,$2)", [ADMIN, t.id], /MATCHDAY_CLOSED/);
  await db.query("update matchdays set status='open', mercato_stage='idle' where id=$1", [w.day]);
  await db.query("select public.admin_cancel_direct_transfer($1,$2)", [ADMIN, t.id]);
});

test("Mercato: orders need an open stage; update values, then roll back exactly", async () => {
  const { sold, bought } = gk();
  // Stage "idle" (or any non-open stage) refuses orders.
  await fails("select submit_mercado_order($1,$2,$3,$4,1000000,1000000,80000,100000)", [GAMER, w.day, sold, bought], /./);
  await db.query("select public.admin_transition_matchday($1,$2,'mercado')", [ADMIN, w.day]);
  const [stage] = await w.q<{ mercato_stage: string; mercato_opens_at: string | null }>("select mercato_stage,mercato_opens_at from matchdays where id=$1", [w.day]);
  assert.equal(stage.mercato_stage, "open", "entering the Mercato phase opens the stage");
  assert.ok(stage.mercato_opens_at, "opening time is stamped");

  await db.query("select submit_mercado_order($1,$2,$3,$4,1000000,1000000,80000,100000)", [GAMER, w.day, sold, bought]);
  await db.query("update matchdays set mercato_stage='frozen' where id=$1", [w.day]);
  const [order] = await w.q<{ id: string }>("select id from mercado_orders where status='pending'");
  await assert.rejects(() => db.query("insert into mercado_orders(squad_id,matchday_id,sold_player_id,bought_player_id,submitted_sold_value,submitted_bought_value,submitted_tax,fixed_commission) values($1,$2,$3,$4,1,1,0,0)", [w.squadId, w.day, w.squad[5].id, w.spare[5].id]), /MERCADO_NOT_OPEN/, "no new order once frozen");

  const before = await budget();
  const run = (await w.q<{ id: string }>("select public.commit_mercado_run($1,$2,$3::jsonb,$4::jsonb) id", [ADMIN, w.day, JSON.stringify([{ orderId: order.id }]), JSON.stringify([{ playerId: bought, beforeValue: 1000000, delta: 10000 }, { playerId: sold, beforeValue: 1000000, delta: -10000 }])]))[0].id;
  assert.ok(run);
  assert.equal(await owns(bought), true); assert.equal(await owns(sold), false);
  // Closing prices apply: sold 990 000, bought 1 010 000, tax 8 % of the closing price (80 800), commission 100 000.
  assert.equal(await budget(), before + 990000 - 1010000 - 80800 - 100000);
  assert.equal(await value(bought), 1010000);

  await fails("select public.admin_rollback_mercado_run($1,$2)", [GAMER, w.day], /ADMIN_REQUIRED/);
  const [count] = await w.q<{ n: number }>("select public.admin_rollback_mercado_run($1,$2) n", [ADMIN, w.day]);
  assert.equal(count.n, 1);
  assert.equal(await owns(sold), true); assert.equal(await owns(bought), false);
  assert.equal(await budget(), before);
  assert.equal(await value(bought), 1000000); assert.equal(await value(sold), 1000000);
  const [o] = await w.q<{ status: string }>("select status from mercado_orders where id=$1", [order.id]);
  assert.equal(o.status, "pending", "the order is back in the book");
  assert.equal((await w.q("select 1 from mercado_runs")).length, 0, "the run is removed so it can be executed again");
  await fails("select public.admin_rollback_mercado_run($1,$2)", [ADMIN, w.day], /NO_COMPLETED_RUN/);

  // Executing again after a rollback works and the mercato can then close.
  await db.query("select public.commit_mercado_run($1,$2,$3::jsonb,'[]'::jsonb)", [ADMIN, w.day, JSON.stringify([{ orderId: order.id }])]);
  await db.query("select public.admin_transition_matchday($1,$2,'closed')", [ADMIN, w.day]);
  const [done] = await w.q<{ mercato_stage: string }>("select mercato_stage from matchdays where id=$1", [w.day]);
  assert.equal(done.mercato_stage, "thawed", "closing the matchday thaws the stage");
});

test("closing a Mercato with pending orders is refused", async () => {
  const fresh = await bootDb();
  const x = await seedWorld(fresh);
  const sold = x.squad.find((p) => p.position === "GK")!.id, bought = x.spare.find((p) => p.position === "GK")!.id;
  await fresh.query("select public.admin_transition_matchday($1,$2,'mercado')", [ADMIN, x.day]);
  await fresh.query("select submit_mercado_order($1,$2,$3,$4,1000000,1000000,80000,100000)", [GAMER, x.day, sold, bought]);
  await assert.rejects(() => fresh.query("select public.admin_transition_matchday($1,$2,'closed')", [ADMIN, x.day]), /MERCADO_ORDERS_MUST_BE_EXECUTED/);
});
