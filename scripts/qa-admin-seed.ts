/**
 * Creates (or removes) a dedicated, clearly labelled test administrator in the hosted TEST project so the admin console
 * can be exercised with a real session. It never promotes an existing account.
 *
 *   npx tsx scripts/qa-admin-seed.ts           create (idempotent)
 *   npx tsx scripts/qa-admin-seed.ts --reset   delete the account
 *
 * Credentials are written to .figma-cache/qa-admin-credentials.json (never printed, never committed).
 */
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = (name: string) => readFileSync(".env.local", "utf8").split(/\r?\n/).find((l) => l.startsWith(`${name}=`))!.slice(name.length + 1).trim().replace(/^['"]|['"]$/g, "");
const db = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
const EMAIL = "qa.admin@marketfoot.test";
const USERNAME = "QA_Admin";
const CREDS = ".figma-cache/qa-admin-credentials.json";

async function findUser() {
  for (let page = 1; page <= 10; page++) {
    const { data } = await db.auth.admin.listUsers({ page, perPage: 200 });
    const hit = data.users.find((u) => u.email === EMAIL);
    if (hit) return hit;
    if (data.users.length < 200) break;
  }
  return null;
}

async function main() {
  const existing = await findUser();
  if (process.argv.includes("--reset")) {
    if (existing) { await db.from("admin_audit_log").delete().eq("actor_id", existing.id); await db.auth.admin.deleteUser(existing.id); }
    console.log(existing ? "QA admin removed." : "No QA admin to remove.");
    return;
  }
  let password = "";
  if (existsSync(CREDS) && existing) password = JSON.parse(readFileSync(CREDS, "utf8")).password;
  if (!password) password = `Qa-${randomBytes(12).toString("base64url")}!9`;
  let user = existing;
  if (!user) {
    const { data, error } = await db.auth.admin.createUser({ email: EMAIL, password, email_confirm: true, user_metadata: { username: USERNAME } });
    if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
    user = data.user;
  } else await db.auth.admin.updateUserById(user.id, { password });
  // handle_new_user creates the profile; this is the only place the QA account is given the admin role.
  const { error } = await db.from("profiles").upsert({ id: user.id, username: USERNAME, role: "admin" }, { onConflict: "id" });
  if (error) throw new Error(`profile: ${error.message}`);
  if (!existsSync(".figma-cache")) mkdirSync(".figma-cache");
  writeFileSync(CREDS, JSON.stringify({ email: EMAIL, password }));
  console.log(`QA admin ready (${USERNAME}). Credentials saved to ${CREDS}.`);
}

main().catch((error) => { console.error(error.message); process.exit(1); });
