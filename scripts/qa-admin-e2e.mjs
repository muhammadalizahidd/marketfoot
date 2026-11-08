/**
 * End-to-end checks of the admin console against the hosted TEST project with a real QA_Admin session.
 *   npx tsx scripts/qa-admin-seed.ts            (once)  → creates QA_Admin
 *   npx next build && npx next start -p 3100       (running)
 *   node scripts/qa-admin-e2e.mjs baremes saison saisie mercato managers parametres bonus
 * Each scenario cleans up what it created. Exit code 1 when any check fails.
 */
import { spawn } from "node:child_process";
import { openSession, results, sleep } from "./e2e/harness.mjs";
import * as a from "./e2e/scenarios-a.mjs";
import * as b from "./e2e/scenarios-b.mjs";
import * as c from "./e2e/scenarios-c.mjs";
import * as d from "./e2e/scenarios-d.mjs";
import * as e from "./e2e/scenarios-e.mjs";

/** Starts (or restarts) the dev server when it is down: a dropped network connection can crash `next dev`. */
async function ensureServer() {
  const up = async () => { try { return (await fetch("http://localhost:3100/connexion")).status === 200; } catch { return false; } };
  if (await up()) return;
  console.log("(dev server down — restarting production server)");
  spawn("npx", ["next", "start", "-p", "3100"], { shell: true, detached: true, stdio: "ignore" }).unref();
  for (let i = 0; i < 90 && !(await up()); i++) await sleep(2000);
}

const SCENARIO_LIMIT_MIN = 15;
const registry = { ...a, ...b, ...c, ...d, ...e };
const wanted = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(registry);
const session = await openSession(".figma-cache/qa-admin-credentials.json");
try {
  for (const name of wanted) {
    if (!registry[name]) { console.log(`unknown scenario: ${name}`); continue; }
    await ensureServer();
    try { await Promise.race([registry[name](session), new Promise((_, reject) => setTimeout(() => reject(new Error(`scenario exceeded ${SCENARIO_LIMIT_MIN} minutes`)), SCENARIO_LIMIT_MIN * 60_000))]); } catch (error) { results.push({ label: `${name}: scenario crashed`, ok: false, detail: error.message }); console.log(`FAIL  ${name}: scenario crashed -> ${error.message}`); }
    await sleep(300);
  }
} finally { session.close(); }
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
for (const f of failed) console.log(` ✗ ${f.label} ${f.detail}`);
process.exit(failed.length ? 1 : 0);
