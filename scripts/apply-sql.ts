/**
 * Applies one SQL migration file to the database in DATABASE_URL inside a transaction.
 *   npx tsx scripts/apply-sql.ts supabase/migrations/<file>.sql
 * The statement text is never printed; only success or the database error message.
 */
import { readFileSync } from "node:fs";
import { Client } from "pg";

const env = (name: string) => readFileSync(".env.local", "utf8").split(/\r?\n/).find((l) => l.startsWith(`${name}=`))!.slice(name.length + 1).trim().replace(/^['"]|['"]$/g, "");
const file = process.argv[2];
if (!file) { console.error("usage: apply-sql.ts <file.sql>"); process.exit(1); }

(async () => {
  const client = new Client({ connectionString: env("DATABASE_URL"), ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query("begin");
    await client.query(readFileSync(file, "utf8"));
    await client.query("commit");
    console.log(`Applied ${file}`);
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    console.error("FAILED:", (error as Error).message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();
