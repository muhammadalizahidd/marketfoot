import test from "node:test";
import assert from "node:assert/strict";
import { bootDb, seedWorld } from "../helpers/db";

test("all migrations apply and the world seeds", async () => {
  const db = await bootDb();
  const w = await seedWorld(db);
  assert.equal(w.squad.length, 19);
  const [row] = await w.q<{ n: string }>("select count(*) n from squad_members where squad_id=$1", [w.squadId]);
  assert.equal(Number(row.n), 19);
});
