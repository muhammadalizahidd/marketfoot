import { service, sql } from "./harness.mjs";
for (const row of await sql("select id from profiles where username like 'E2E_%' or username like 'supprime-%'")) {
  await sql("delete from financial_ledger where gamer_id=$1", [row.id]).catch(() => undefined);
  await sql("delete from gamer_finances where gamer_id=$1", [row.id]).catch(() => undefined);
  const { error } = await service.auth.admin.deleteUser(row.id);
  console.log(row.id.slice(0, 8), error ? `kept: ${error.message}` : "deleted");
}
