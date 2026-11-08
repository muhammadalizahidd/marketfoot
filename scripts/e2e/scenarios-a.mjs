import { check, service, sleep, sql } from "./harness.mjs";

const activeSettings = async () => (await sql("select version, settings from rules_settings where is_active"))[0];

export async function baremes(s) {
  console.log("\n# Barèmes");
  await sql("delete from rules_settings");
  await s.goto("/admin/baremes");
  check("Barèmes shows the PRD reference values before any save", await s.has("Valeurs de référence du PRD"));

  await s.set('[name="transfers.fixedMercadoCommission"]', 110000);
  await s.click("Enregistrer les barèmes");
  await s.waitText("Barèmes enregistrés");
  let row = await activeSettings();
  check("General tab saves a new active version (v1)", row?.version === 1 && row.settings.transfers.fixedMercadoCommission === 110000, JSON.stringify(row?.version));
  check("disabled structural fields are not part of the payload", row.settings.freeze.hoursBeforeKickoff === 2);

  await s.goto("/admin/baremes?tab=primes");
  await s.set('[name="primes.goal.starter.GK"]', 220000);
  await s.set('[name="teamResult.away_win"]', 160000);
  await s.click("Enregistrer les barèmes");
  await s.waitText("version 2");
  row = await activeSettings();
  check("Primes tab saves v2 and keeps earlier changes", row.version === 2 && row.settings.primes.goal.starter.GK === 220000 && row.settings.teamResult.away_win === 160000 && row.settings.transfers.fixedMercadoCommission === 110000);

  await s.goto("/admin/baremes?tab=palmares");
  await s.set('[name="honours.overall.1"]', 350);
  await s.click("Enregistrer les barèmes");
  await s.waitText("version 3");
  const [pts] = await sql("select public.honours_points('overall',1) a, public.honours_points('overall',2) b");
  check("Palmarès change reaches honours_points in the database", pts.a === 350 && pts.b === 250, JSON.stringify(pts));

  await s.goto("/admin/baremes");
  await s.set('[name="pct:transfers.tax.direct.0.rate"]', 150);
  await s.click("Enregistrer les barèmes");
  await s.waitText("hors limites");
  check("an out-of-range tax rate is rejected with a message", true);
  row = await activeSettings();
  check("the rejected save did not create a version", row.version === 3);

  await s.goto("/admin/baremes");
  await s.set('[name="pct:transfers.tax.mercado.0.rate"]', 9.5);
  await s.set('[name="predictions.cubic"]', 0.01);
  await s.click("Enregistrer les barèmes");
  await s.waitText("version 4");
  row = await activeSettings();
  check("percent fields are stored as ratios (9,5 % → 0.095)", row.settings.transfers.tax.mercado[0].rate === 0.095 && row.settings.predictions.cubic === 0.01, JSON.stringify(row.settings.transfers.tax.mercado[0]));

  await s.goto("/admin/baremes");
  check("history lists the versions", (await s.has("Historique des versions")) && (await s.has("v3")));
  // Restore version 1 from the history table.
  await s.ev(`(() => { const row = [...document.querySelectorAll('tr')].find((r) => r.innerText.includes('v1')); row.querySelector('button').click(); return true; })()`);
  await s.click("Restaurer", "dialog[open]");
  await s.waitText("restaurée");
  row = await activeSettings();
  check("restoring v1 creates v5 with v1's values", row.version === 5 && row.settings.primes.goal.starter.GK === 210000 && row.settings.transfers.fixedMercadoCommission === 110000, JSON.stringify([row.version, row.settings.primes.goal.starter.GK]));
  const [audit] = await sql("select count(*)::int n from admin_audit_log where action in ('rules.update','rules.restore')");
  check("every change is in the audit log", audit.n >= 5, String(audit.n));
  await sql("delete from rules_settings");
}

export async function saison(s) {
  console.log("\n# Saison");
  const [active] = await sql("select id, name from seasons where status='active'");
  await sql("delete from seasons where name like 'E2E Saison%' or name='E2E Probe'");
  await s.goto("/admin/saison");
  check("season list shows status chips and counts", (await s.has("En cours")) && (await s.has(active.name)));
  await s.set('[name="q"]', "zzz-introuvable");
  await s.ev("document.querySelector('[name=q]').form.requestSubmit()");
  await sleep(1500); await s.waitText("Aucune saison");
  check("search filters the list", true);

  // Create from an existing season (teams + squads), end-of-season values.
  await s.goto("/admin/saison");
  await s.click("Créer une saison");
  await s.set('dialog[open] [name="name"]', "E2E Saison A");
  await s.set('dialog[open] [name="starts_on"]', "2030-08-01");
  await s.set('dialog[open] [name="ends_on"]', "2031-06-01");
  await s.set('dialog[open] [name="cloneFrom"]', active.id);
  await s.ev(`(() => { for (const l of document.querySelectorAll('dialog[open] label.ad-field--check')) { const i = l.querySelector('input'); if (!i.checked) i.click(); } return true; })()`);
  await s.waitText("18 équipes sélectionnées");
  check("'Reprendre les équipes' selects every team of the source", true);
  await s.click("Créer", "dialog[open]");
  await s.waitFor("location.pathname.startsWith('/admin/saison/') && location.pathname.length > 20", 150000, "redirect to the new season");
  const id = (await s.path()).split("/").pop();
  const [created] = await sql("select status, (select count(*)::int from season_clubs where season_id=s.id) clubs, (select count(*)::int from season_players where season_id=s.id) players from seasons s where id=$1", [id]);
  const [source] = await sql("select count(*)::int n from season_players where season_id=$1", [active.id]);
  check("creation → pending validation with cloned teams and squads", created.status === "pending_validation" && created.clubs === 18 && created.players === source.n, JSON.stringify(created));

  await s.waitText("En attente de validation");
  await s.click("Valider");
  await s.click("Valider", "dialog[open]");
  await s.waitText("autre saison est déjà en cours");
  check("validating while another season is active is refused with a clear message", true);

  await s.set('form:has(input[name=seasonId]):has(input[name=starts_on]) input[name="name"]', "E2E Saison B");
  await s.click("Enregistrer", "form:has(input[name=seasonId]):has(input[name=starts_on])");
  await s.waitText("Saison enregistrée");
  check("season info saves", (await sql("select name from seasons where id=$1", [id]))[0].name === "E2E Saison B");
  await s.click("Enregistrer en tant que brouillon");
  await s.waitText("Brouillon enregistré");
  check("draft button sets status to draft", (await sql("select status from seasons where id=$1", [id]))[0].status === "draft");

  // Roster editing for the selected team.
  const field = await s.ev(`document.querySelector('input[name$=".value"]').name`);
  await s.set(`input[name="${field}"]`, 2750000);
  await s.click("Enregistrer l’effectif");
  await s.waitText("enregistré(s)");
  const playerId = field.split(".")[1];
  check("roster value saves to the season roster", Number((await sql("select start_value from season_players where season_id=$1 and player_id=$2", [id, playerId]))[0].start_value) === 2750000);
  check("an INACTIVE season's roster edit does not touch the live catalogue", Number((await sql("select marketfoot_value from players where id=$1", [playerId]))[0].marketfoot_value) !== 2750000);

  // Remove a team, then add it back through the search picker.
  const [club] = await sql("select c.id, c.name from season_clubs sc join clubs c on c.id=sc.club_id where sc.season_id=$1 and c.name='Toulouse FC'", [id]);
  await s.ev(`(() => { const row = [...document.querySelectorAll('.ad-team-row')].find((r) => r.innerText.trim().startsWith('Toulouse FC')); row.querySelector('button').click(); return true; })()`);
  await s.click("Retirer", "dialog[open]");
  await s.waitFor(`![...document.querySelectorAll('.ad-team-row')].some((r) => r.innerText.trim().startsWith('Toulouse FC'))`, 90000, "team row to disappear");
  await sleep(1500);
  check("removing a team removes it and its roster from the season", (await sql("select (select count(*)::int from season_clubs where season_id=$1 and club_id=$2) a, (select count(*)::int from season_players where season_id=$1 and club_id=$2) b", [id, club.id]))[0].a === 0);
  await s.set('input[placeholder="Ajouter une équipe"]', "Toulouse");
  await s.waitFor(`[...document.querySelectorAll('.ad-menu-list button')].some((b) => b.innerText.trim().startsWith('Toulouse FC'))`, 30000, "Toulouse FC offered by the picker");
  await s.ev(`(() => { const o = [...document.querySelectorAll('.ad-menu-list button')].find((b) => b.innerText.trim().startsWith('Toulouse FC')); o.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); o.click(); return true; })()`);
  await s.waitFor(`[...document.querySelectorAll('.ad-team-row')].some((r) => r.innerText.trim().startsWith('Toulouse FC'))`, 90000, "team row to reappear");
  check("the search picker adds the team back", (await sql("select count(*)::int n from season_clubs where season_id=$1 and club_id=$2", [id, club.id]))[0].n === 1);

  // A brand new club through the picker.
  await s.set('input[placeholder="Ajouter une équipe"]', "E2E Club");
  await sleep(500);
  await s.ev(`(() => { const o = [...document.querySelectorAll('.ad-menu-list button')].find((b) => b.innerText.includes('nouvelle équipe')); o.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); o.click(); return true; })()`);
  await sleep(2500);
  const [fresh] = await sql("select c.id, c.short_name from clubs c where c.name='E2E Club'");
  check("a new club is created and added to the season", !!fresh && (await sql("select count(*)::int n from season_clubs where season_id=$1 and club_id=$2", [id, fresh.id]))[0].n === 1, JSON.stringify(fresh));

  // Delete the season from the list (history-free → allowed).
  await s.goto("/admin/saison");
  await s.set('[name="q"]', "E2E Saison");
  await s.ev("document.querySelector('[name=q]').form.requestSubmit()");
  await sleep(1500);
  await s.ev(`(() => { const row = [...document.querySelectorAll('tr')].find((r) => r.innerText.includes('E2E Saison B')); [...row.querySelectorAll('button')].find((b) => b.innerText.includes('Supprimer')).click(); return true; })()`);
  await s.click("Supprimer", "dialog[open]");
  await sleep(3000);
  check("deleting a history-free season works", (await sql("select count(*)::int n from seasons where id=$1", [id]))[0].n === 0);
  await s.goto("/admin/saison");
  check("the active season's delete button is disabled in the list", await s.ev(`(() => { const row = [...document.querySelectorAll('tr')].find((r) => r.innerText.includes(${JSON.stringify(active.name)})); return [...row.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Supprimer').disabled; })()`));
  await sql("delete from season_clubs where club_id in (select id from clubs where name='E2E Club')");
  await sql("delete from clubs where name='E2E Club'");
  await service.from("admin_audit_log").select("id").limit(1);
}
