import { check, env, openSession, service, sleep, sql } from "./harness.mjs";
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";

const until = async (fn, ms = 90000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await sleep(700); } return false; };
const PASSWORD = "E2e-Throwaway-9!x";

async function makeUser(tag) {
  const email = `e2e.${tag}@marketfoot.test`;
  const username = `E2E_${tag}`;
  const { data: list } = await service.auth.admin.listUsers({ page: 1, perPage: 200 });
  const old = list.users.find((u) => u.email === email);
  if (old) await dropUser(old.id);
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { username } });
  if (error) throw new Error(`createUser ${tag}: ${error.message}`);
  return { id: data.user.id, email, username };
}
async function dropUser(id) {
  await sql("delete from financial_ledger where gamer_id=$1", [id]).catch(() => undefined);
  await sql("delete from gamer_finances where gamer_id=$1", [id]).catch(() => undefined);
  await service.auth.admin.deleteUser(id).catch(() => undefined);
}

export async function managers(s) {
  console.log("\n# Managers");
  const [qa] = await sql("select p.id gamer, s.id squad from profiles p join squads s on s.gamer_id=p.id where p.username='QA_Claude'");
  const m1 = await makeUser("m1");
  const m2 = await makeUser("m2");
  await sql("insert into gamer_finances(gamer_id,budget,blocked_account) values($1,1000000,0) on conflict (gamer_id) do nothing", [m2.id]);
  await sql("insert into financial_ledger(gamer_id,event_type,budget_delta,locked_account_delta,idempotency_key) values($1,'matchday_settlement',1000000,0,$2) on conflict (idempotency_key) do nothing", [m2.id, `e2e-init:${m2.id}`]);
  const snapshot = {
    members: await sql("select * from squad_members where squad_id=$1", [qa.squad]),
    finance: (await sql("select budget, blocked_account from gamer_finances where gamer_id=$1", [qa.gamer]))[0],
    profile: (await sql("select bio, country, reset_at from profiles where id=$1", [qa.gamer]))[0],
  };
  const restoreQa = async () => {
    if ((await sql("select count(*)::int n from squad_members where squad_id=$1", [qa.squad]))[0].n === 0 && snapshot.members.length) await sql("insert into squad_members select * from jsonb_populate_recordset(null::squad_members, $1::jsonb)", [JSON.stringify(snapshot.members)]);
    await sql("update gamer_finances set budget=$2, blocked_account=$3 where gamer_id=$1", [qa.gamer, snapshot.finance.budget, snapshot.finance.blocked_account]);
    await sql("update profiles set reset_at=$2, banned_at=null, banned_reason=null, bio=$3, country=$4 where id=$1", [qa.gamer, snapshot.profile.reset_at, snapshot.profile.bio, snapshot.profile.country]);
  };
  // Self-healing: the snapshot lives on disk, so an interrupted run can never leave the QA manager reset.
  const SNAP = ".figma-cache/qa-managers-snapshot.json";
  if (!snapshot.members.length && existsSync(SNAP)) { Object.assign(snapshot, JSON.parse(readFileSync(SNAP, "utf8"))); await restoreQa(); console.log("(restored the QA squad from the saved snapshot)"); }
  else if (snapshot.members.length) writeFileSync(SNAP, JSON.stringify(snapshot));
  let player = await openSession(".figma-cache/qa-credentials.json");
  try {
    // List, KPIs, search, export.
    await s.goto("/admin/managers");
    check("list shows KPIs and the QA manager", (await s.has("Inscrits")) && (await s.has("Nouveaux inscrits cette semaine")) && (await s.has("En ligne")) && (await s.has("QA_Claude")));
    await s.set('[name="q"]', "e2e.m1"); await s.ev("document.querySelector('[name=q]').form.requestSubmit()");
    await s.waitFor("!document.body.innerText.includes('QA_Claude') && document.body.innerText.includes('E2E_m1')", 60000, "search by e-mail");
    check("search by e-mail narrows the list", true);
    const csv = await s.ev(`fetch('/admin/export/managers?q=e2e.m1').then((r) => r.text())`);
    check("CSV export honours the filter", csv.includes('"Nom";"Mail"') && csv.includes("e2e.m1") && !csv.includes("QA_Claude"), csv.slice(0, 120));
    await player.goto("/mon-equipe");
    const [seen] = await sql("select last_seen_at from profiles where id=$1", [qa.gamer]);
    check("player visits record presence (feeds 'En ligne')", seen.last_seen_at && Date.now() - new Date(seen.last_seen_at).getTime() < 3600_000, String(seen.last_seen_at));

    // Profile edit + duplicate username.
    await s.goto(`/admin/managers/${m1.id}`);
    await s.set('input[name="bio"]', "Bio E2E"); await s.set('input[name="country"]', "France - Île de France");
    await s.click("Enregistrer", "form:has(input[name=bio])");
    check("profile edit saves bio and country", await until(async () => (await sql("select bio, country from profiles where id=$1", [m1.id]))[0].bio === "Bio E2E"));
    await s.set('input[name="username"]', "QA_Claude"); await s.clickReady("Enregistrer", "form:has(input[name=bio])");
    await s.waitText("déjà utilisé");
    check("a duplicate pseudo is refused and the form keeps what was typed", (await s.ev(`document.querySelector('input[name="username"]').value`)) === "QA_Claude");
    await s.goto(`/admin/managers/${m1.id}`);

    // Linked accounts.
    await sql("insert into profile_ip_events(gamer_id,ip_hash) values($1,'e2ehash'),($2,'e2ehash')", [m1.id, qa.gamer]);
    await s.goto(`/admin/managers/${m1.id}`);
    check("linked accounts lists the manager sharing an address", (await s.has("Comptes liés")) && (await s.has("Même IP")) && (await s.has("QA_Claude")));
    await s.goto("/admin/managers");
    check("the list flags linked accounts", await s.has("lié"));
    await sql("delete from profile_ip_events where ip_hash='e2ehash'");

    // Ban / unban (auth-level).
    await s.goto(`/admin/managers/${m1.id}`);
    const anon = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), { auth: { persistSession: false } });
    check("fixture: the throwaway manager can sign in", !(await anon.auth.signInWithPassword({ email: m1.email, password: PASSWORD })).error);
    await s.click("Bannir"); await s.set("dialog[open] [name=reason]", "Multi-comptes (test E2E)"); await s.click("Bannir", "dialog[open] form");
    check("ban stores status and reason", await until(async () => (await sql("select banned_at, banned_reason from profiles where id=$1", [m1.id]))[0].banned_at !== null));
    const banned = await anon.auth.signInWithPassword({ email: m1.email, password: PASSWORD });
    check("a banned manager can no longer sign in", Boolean(banned.error), banned.error?.message ?? "signed in");
    await s.goto(`/admin/managers/${m1.id}`);
    check("detail shows the Banni status", await s.has("Banni"));
    await s.click("Débannir"); await s.click("Débannir", "dialog[open]");
    check("unban clears the status", await until(async () => (await sql("select banned_at from profiles where id=$1", [m1.id]))[0].banned_at === null));
    check("an unbanned manager can sign in again", !(await anon.auth.signInWithPassword({ email: m1.email, password: PASSWORD })).error);
    // Ban takes effect immediately for an already-open session.
    const live = await openSession(".figma-cache/qa-credentials.json");
    try {
      await sql("update profiles set banned_at=now() where id=$1", [qa.gamer]);
      await live.goto("/mon-equipe", "true").catch(() => undefined);
      await sleep(1500);
      check("an open session of a banned manager is signed out at the next page", (await live.path()).startsWith("/connexion"), await live.path());
    } finally { await sql("update profiles set banned_at=null, banned_reason=null where id=$1", [qa.gamer]); live.close(); }

    // Finance correction.
    await s.goto(`/admin/managers/${qa.gamer}`);
    const budget = Number(snapshot.finance.budget);
    await s.ev(`(() => { const card = [...document.querySelectorAll('.ad-card')].find((c) => c.querySelector('.ad-card-head')?.innerText.trim() === 'Budget'); [...card.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Corriger').click(); return true; })()`);
    await s.set("dialog[open] [name=value]", budget + 1234); await s.set("dialog[open] [name=reason]", "Test E2E correction");
    await s.click("Corriger", "dialog[open] form");
    check("budget correction adjusts the account and writes the ledger", await until(async () => Math.abs(Number((await sql("select budget from gamer_finances where gamer_id=$1", [qa.gamer]))[0].budget) - (budget + 1234)) < 0.01) && (await sql("select count(*)::int n from financial_ledger where gamer_id=$1 and event_type='admin_correction'", [qa.gamer]))[0].n >= 1);
    await sql("update gamer_finances set budget=$2 where gamer_id=$1", [qa.gamer, snapshot.finance.budget]);

    // Counters.
    const day = (await sql("select d.id from matchdays d join seasons z on z.id=d.season_id where z.status='active' order by d.number limit 1"))[0];
    const someone = (await sql("select sm.player_id from squad_members sm where sm.squad_id=$1 order by sm.player_id limit 1", [qa.squad]))[0];
    await sql("insert into captain_assignments(squad_id,matchday_id,player_id) values($1,$2,$3) on conflict do nothing", [qa.squad, day.id, someone.player_id]);
    await sql("insert into bonus_plays(squad_id,matchday_id,season_id,bonus_id) select $1,$2,season_id,'cholismo' from matchdays where id=$2 on conflict do nothing", [qa.squad, day.id]);
    await s.goto(`/admin/managers/${qa.gamer}`);
    check("counters show captain and bonus usage", (await s.has("1/6")) && (await s.has("1/4")));
    await s.ev(`(() => { const card = [...document.querySelectorAll('.ad-card')].find((c) => c.querySelector('.ad-card-head')?.innerText.includes('Compteur Bonus')); [...card.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Réinitialiser' && !b.disabled).click(); return true; })()`);
    await s.click("Réinitialiser", "dialog[open]");
    const bonusGone = await until(async () => (await sql("select count(*)::int n from bonus_plays where squad_id=$1", [qa.squad]))[0].n === 0, 30000);
    check("resetting the bonus counter removes the plays", bonusGone, await s.ev("document.querySelector('.ad-flash')?.innerText ?? 'no toast'"));
    await s.goto(`/admin/managers/${qa.gamer}`);
    await s.ev(`(() => { const card = [...document.querySelectorAll('.ad-card')].find((c) => c.querySelector('.ad-card-head')?.innerText.includes('Compteur capitanat')); [...card.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Réinitialiser').click(); return true; })()`);
    await s.click("Réinitialiser", "dialog[open]");
    check("resetting the captain counter removes the assignments", await until(async () => (await sql("select count(*)::int n from captain_assignments where squad_id=$1", [qa.squad]))[0].n === 0));

    // Account reset → manager must rebuild.
    await s.goto(`/admin/managers/${qa.gamer}`);
    await s.click("Réinitialiser le compte"); await s.click("Réinitialiser", "dialog[open]");
    check("account reset empties the squad", await until(async () => (await sql("select count(*)::int n from squad_members where squad_id=$1", [qa.squad]))[0].n === 0));
    const [afterReset] = await sql("select budget, blocked_account from gamer_finances where gamer_id=$1", [qa.gamer]);
    check("reset keeps the Blocked Account", Math.abs(Number(afterReset.blocked_account) - Number(snapshot.finance.blocked_account)) < 0.01);
    player.close(); player = await openSession(".figma-cache/qa-credentials.json"); // the ban test signed this user out everywhere
    await player.goto("/mon-equipe").catch(() => undefined);
    await sleep(1500);
    check("the manager is sent to rebuild the team", (await player.has("pas encore créée")) || (await player.path()).includes("onboarding"), await player.path());
    await restoreQa();
    check("QA squad restored after the reset test", (await sql("select count(*)::int n from squad_members where squad_id=$1", [qa.squad]))[0].n === snapshot.members.length);

    // Delete: no history → removed; with history → anonymised and locked.
    await s.goto("/admin/managers");
    await s.set('[name="q"]', "e2e.m1"); await s.ev("document.querySelector('[name=q]').form.requestSubmit()");
    await s.waitFor("document.body.innerText.includes('E2E_m1')", 60000, "m1 in list");
    await s.ev(`(() => { const row = [...document.querySelectorAll('tr')].find((r) => r.innerText.includes('E2E_m1')); [...row.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Supprimer').click(); return true; })()`);
    await s.click("Supprimer", "dialog[open]");
    check("a manager without history is deleted", await until(async () => (await sql("select count(*)::int n from profiles where id=$1", [m1.id]))[0].n === 0));
    await s.goto(`/admin/managers/${m2.id}`);
    await s.click("Supprimer le compte"); await s.click("Supprimer", "dialog[open]");
    check("a manager with history is anonymised and locked", await until(async () => { const [p] = await sql("select username, banned_at from profiles where id=$1", [m2.id]); return p?.username?.startsWith("supprime-") && p.banned_at; }));
  } finally {
    await restoreQa();
    await dropUser(m1.id); await dropUser(m2.id);
    player.close();
  }
}

export async function parametres(s) {
  console.log("\n# Paramètres");
  await sql("delete from rules_settings");
  const m3 = await makeUser("m3");
  const [me] = await sql("select id from profiles where username='QA_Admin'");
  try {
    await s.goto("/admin/parametres");
    check("Paramètres shows calendar, site state, admins and the audit log", (await s.has("Calendrier par défaut")) && (await s.has("État du site")) && (await s.has("Administrateurs")) && (await s.has("Journal d’audit")));
    await s.set('[name="schedule.mercatoOpen.day"]', 3); await s.set('[name="str:schedule.mercatoOpen.time"]', "18:30");
    await s.click("Enregistrer le calendrier");
    check("the default calendar is saved in the settings", await until(async () => { const [r] = await sql("select settings->'schedule'->'mercatoOpen' x from rules_settings where is_active"); return r?.x?.day === 3 && r.x.time === "18:30"; }));

    await s.goto("/admin/parametres");
    await s.set('input[name="reason"]', "Maintenance E2E"); await s.click("Geler le site");
    check("manual freeze is stored", await until(async () => (await sql("select frozen, reason from site_state"))[0].frozen === true));
    await s.goto("/admin/parametres");
    check("the page reflects the freeze", await s.has("Gelé"));
    await s.click("Dégeler le site"); await s.click("Dégeler", "dialog[open]");
    check("thaw is stored", await until(async () => (await sql("select frozen from site_state"))[0].frozen === false));

    await s.goto("/admin/parametres");
    await s.set('input[name="username"]', m3.username); await s.click("Ajouter");
    check("an account can be promoted to administrator by exact pseudo", await until(async () => (await sql("select role from profiles where id=$1", [m3.id]))[0].role === "admin"));
    await s.goto("/admin/parametres");
    await s.ev(`(() => { const row = [...document.querySelectorAll('tr')].find((r) => r.innerText.includes('${m3.username}')); [...row.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Retirer').click(); return true; })()`);
    await s.click("Retirer", "dialog[open]");
    check("administrator rights can be withdrawn", await until(async () => (await sql("select role from profiles where id=$1", [m3.id]))[0].role === "gamer"));
    await s.ev(`(() => { const row = [...document.querySelectorAll('tr')].find((r) => r.innerText.includes('QA_Admin')); [...row.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Retirer').click(); return true; })()`);
    await s.click("Retirer", "dialog[open]");
    await s.waitText("propres droits");
    check("an administrator cannot remove their own rights", (await sql("select role from profiles where id=$1", [me.id]))[0].role === "admin");
    await s.goto("/admin/parametres");
    await s.click("Purger les empreintes de plus de 90 jours");
    await s.waitText("empreinte(s) de connexion supprimée(s)");
    check("IP-hash purge reports its result", true);
    await s.goto("/admin/parametres");
    check("the audit log lists the actions just performed", (await s.has("site.freeze")) && (await s.has("admin.promote")) && (await s.has("rules.update")));
  } finally { await sql("delete from rules_settings"); await sql("update site_state set frozen=false, reason=null"); await dropUser(m3.id); }
}

export async function bonus() {
  console.log("\n# Bonus (player side)");
  const [qa] = await sql("select p.id gamer, s.id squad from profiles p join squads s on s.gamer_id=p.id where p.username='QA_Claude'");
  const [day] = await sql("select d.id, d.number, d.season_id from matchdays d join seasons z on z.id=d.season_id where z.status='active' and d.status='open' order by d.number limit 1");
  const kickoffs = await sql("select id, kickoff_at from matches where matchday_id=$1", [day.id]);
  const player = await openSession(".figma-cache/qa-credentials.json");
  const pick = (title) => player.ev(`(() => { const b = [...document.querySelectorAll('.tm-bonus-item')].find((x) => x.innerText.includes(${JSON.stringify(title)})); if (!b) throw new Error('no bonus ${title}'); b.click(); return true; })()`);
  const plays = async () => (await sql("select bonus_id from bonus_plays where squad_id=$1 and matchday_id=$2", [qa.squad, day.id])).map((r) => r.bonus_id);
  try {
    await sql("delete from bonus_plays where squad_id=$1", [qa.squad]);
    await player.goto("/mon-equipe?tab=composition");
    const titles = ["Le Cholismo", "Le Turpin", "Clean Sheets", "Sorti du frigo", "Caviar en stock", "Fergie Time"];
    check("the panel lists exactly the six PRD bonuses", (await Promise.all(titles.map((t) => player.has(t)))).every(Boolean) && !(await player.has("Football champagne")));
    check("counters start at 0/4 (the Barèmes maximum)", (await player.ev(`[...document.querySelectorAll('.tm-bonus-count')].map((c) => c.innerText).join(',')`)) === "0/4,0/4,0/4,0/4,0/4,0/4");

    await pick("Le Turpin");
    check("choosing a bonus saves it for the matchday", await until(async () => (await plays()).join() === "turpin"));
    await player.goto("/mon-equipe?tab=composition");
    check("the saved choice is highlighted after a reload", await player.ev(`document.querySelector('.tm-bonus-item.is-chosen')?.innerText.includes('Le Turpin')`));
    await pick("Clean Sheets");
    check("picking another bonus replaces the first (one per matchday)", await until(async () => (await plays()).join() === "clean-sheets"));
    await player.goto("/mon-equipe?tab=composition");
    await pick("Clean Sheets");
    check("clicking the chosen bonus withdraws it", await until(async () => (await plays()).length === 0));

    // Season maximum.
    await sql("delete from rules_settings");
    await sql("insert into rules_settings(version,settings,is_active) values(1,'{\"bonus\":{\"list\":[{\"id\":\"cholismo\",\"enabled\":true,\"maxPerSeason\":1},{\"id\":\"turpin\",\"enabled\":false,\"maxPerSeason\":4},{\"id\":\"clean-sheets\",\"enabled\":true,\"maxPerSeason\":4},{\"id\":\"sorti-du-frigo\",\"enabled\":true,\"maxPerSeason\":4},{\"id\":\"caviar-en-stock\",\"enabled\":true,\"maxPerSeason\":4},{\"id\":\"fergie-time\",\"enabled\":true,\"maxPerSeason\":4}]}}',true)");
    const [other] = await sql("select id from matchdays where season_id=$1 and id<>$2 order by number limit 1", [day.season_id, day.id]);
    await sql("insert into bonus_plays(squad_id,matchday_id,season_id,bonus_id,succeeded,bonus_amount) values($1,$2,$3,'cholismo',true,100)", [qa.squad, other.id, day.season_id]);
    await new Promise((r) => setTimeout(r, 16000)); // settings cache is 15 s
    await player.goto("/mon-equipe?tab=composition");
    const states = await player.ev(`JSON.stringify([...document.querySelectorAll('.tm-bonus-item')].map((b) => [b.querySelector('strong').innerText, b.disabled, b.querySelector('.tm-bonus-count').innerText]))`);
    const map = Object.fromEntries(JSON.parse(states).map(([t, d, c]) => [t, [d, c]]));
    check("a bonus used up for the season is disabled (1/1)", map["Le Cholismo"]?.[0] === true && map["Le Cholismo"]?.[1] === "1/1", JSON.stringify(map["Le Cholismo"]));
    check("a bonus switched off in Barèmes is disabled", map["Le Turpin"]?.[0] === true);
    check("other bonuses stay playable", map["Fergie Time"]?.[0] === false);
    await sql("delete from bonus_plays where squad_id=$1", [qa.squad]); await sql("delete from rules_settings");

    // Lock 2 h before the first match.
    await sql("update matches set kickoff_at=now()+interval '1 hour' where id=$1", [kickoffs[0].id]);
    await player.goto("/mon-equipe?tab=composition");
    check("inside the 2 h window every bonus is locked", await player.ev(`[...document.querySelectorAll('.tm-bonus-item')].every((b) => b.disabled)`));
    for (const k of kickoffs) await sql("update matches set kickoff_at=$2 where id=$1", [k.id, k.kickoff_at]);

    // Frozen site blocks the action with a message.
    await sql("update site_state set frozen=true, reason='E2E'");
    await player.goto("/mon-equipe?tab=composition");
    await pick("Fergie Time");
    await player.waitText("Le site est gelé pendant la mise à jour du Mercato");
    check("a frozen site refuses bonus changes with a clear message", (await plays()).length === 0);
  } finally {
    for (const k of kickoffs) await sql("update matches set kickoff_at=$2 where id=$1", [k.id, k.kickoff_at]);
    await sql("update site_state set frozen=false, reason=null"); await sql("delete from rules_settings"); await sql("delete from bonus_plays where squad_id=$1", [qa.squad]);
    player.close();
  }
}
void writeFileSync; void mkdirSync;
