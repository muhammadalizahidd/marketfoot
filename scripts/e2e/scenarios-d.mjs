import { check, openSession, sleep, sql } from "./harness.mjs";

const num = (v) => Number(v);
const until = async (fn, ms = 90000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await sleep(700); } return false; };

async function pickTrade(gamer, squad, day) {
  // A squad player and a free same-position player whose clubs do not play within the 2 h freeze.
  const [t] = await sql(`select sm.player_id sold, (select p2.id from players p2 where p2.is_active and p2.position=p.position and p2.id not in (select player_id from squad_members where squad_id=$1)
      and p2.club_id <> p.club_id and not exists (select 1 from matches m where m.matchday_id=$2 and (m.home_club_id in (p.club_id,p2.club_id) or m.away_club_id in (p.club_id,p2.club_id)) and m.kickoff_at - interval '2 hours' <= now())
      and (select count(*) from squad_members sm2 join players px on px.id=sm2.player_id where sm2.squad_id=$1 and px.club_id=p2.club_id) < 4 order by p2.id limit 1) bought
    from squad_members sm join players p on p.id=sm.player_id where sm.squad_id=$1 and not exists (select 1 from matches m where m.matchday_id=$2 and (m.home_club_id=p.club_id or m.away_club_id=p.club_id) and m.kickoff_at - interval '2 hours' <= now())
    order by sm.player_id limit 1`, [squad, day]);
  return t;
}
const budgetOf = async (gamer) => num((await sql("select budget from gamer_finances where gamer_id=$1", [gamer]))[0].budget);
const owns = async (squad, player) => (await sql("select 1 from squad_members where squad_id=$1 and player_id=$2", [squad, player])).length === 1;

export async function mercato(s) {
  console.log("\n# Mercato");
  const [admin] = await sql("select id from profiles where username='QA_Admin'");
  const [qa] = await sql("select p.id gamer, s.id squad from profiles p join squads s on s.gamer_id=p.id where p.username='QA_Claude'");
  const [day] = await sql("select d.id, d.number from matchdays d join seasons s on s.id=d.season_id where s.status='active' and d.status='open' order by d.number limit 1");
  if (!day) throw new Error("no open matchday in the active season");
  const original = (await sql("select status, mercato_stage, mercato_opens_at, mercato_closes_at, thaw_at from matchdays where id=$1", [day.id]))[0];
  const trade = await pickTrade(qa.gamer, qa.squad, day.id);
  check("fixture: a valid sell/buy pair exists for QA_Claude", Boolean(trade?.sold && trade?.bought), JSON.stringify(trade));
  const startBudget = await budgetOf(qa.gamer);
  const submit = async () => sql(`select submit_mercado_order($1,$2,$3,$4,sv,bv,round(bv*0.08,2),100000) from (select (select marketfoot_value from players where id=$3) sv, (select marketfoot_value from players where id=$4) bv) q`, [qa.gamer, day.id, trade.sold, trade.bought]);
  const freeTransfer = async () => sql(`select complete_direct_transfer($1,$2,$3,$4,sv,bv,round(bv*0.10,2),(select budget from gamer_finances where gamer_id=$1)+sv-bv-round(bv*0.10,2)) from (select (select marketfoot_value from players where id=$3) sv, (select marketfoot_value from players where id=$4) bv) q`, [qa.gamer, day.id, trade.sold, trade.bought]);
  const player = await openSession(".figma-cache/qa-credentials.json");
  try {
    // ── Free transfers log + admin cancel (stage idle) ─────────────────────────────────────────────
    await freeTransfer();
    check("fixture: the free transfer swapped the squad", (await owns(qa.squad, trade.bought)) && !(await owns(qa.squad, trade.sold)));
    await s.goto("/admin/mercato");
    check("idle state offers 'Ouvrir le mercato' and lists free transfers", (await s.has("Ouvrir le mercato")) && (await s.has("Transfert")) && (await s.has("Validé")));
    await s.ev(`(() => { const row = [...document.querySelectorAll('tr')].find((r) => r.innerText.includes('Validé')); [...row.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Annuler').click(); return true; })()`);
    await s.click("Annuler le transfert", "dialog[open]");
    for (let i = 0; i < 60 && (await owns(qa.squad, trade.bought)); i++) await sleep(1000);
    check("admin cancel of a free transfer restores squad and budget", (await owns(qa.squad, trade.sold)) && !(await owns(qa.squad, trade.bought)) && Math.abs((await budgetOf(qa.gamer)) - startBudget) < 0.01);

    // ── Open the Mercato ───────────────────────────────────────────────────────────────────────────
    await s.goto("/admin/mercato");
    await s.click("Ouvrir le mercato"); await s.click("Ouvrir", "dialog[open]");
    await until(async () => (await sql("select status from matchdays where id=$1", [day.id]))[0].status === "mercado");
    const [opened] = await sql("select status, mercato_stage, mercato_opens_at from matchdays where id=$1", [day.id]);
    check("opening the Mercato moves the matchday to 'mercado' with stage 'open'", opened.status === "mercado" && opened.mercato_stage === "open" && opened.mercato_opens_at !== null, JSON.stringify(opened));

    await submit();
    await s.goto("/admin/mercato");
    check("the order book shows the manager's pending order", (await s.has("En attente")) && (await s.has("1/4")));
    await s.ev(`(() => { const row = [...document.querySelectorAll('tr')].find((r) => r.innerText.includes('En attente')); [...row.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Annuler').click(); return true; })()`);
    await s.click("Annuler l’ordre", "dialog[open]");
    for (let i = 0; i < 60 && (await sql("select 1 from mercado_orders where matchday_id=$1 and status='pending'", [day.id])).length; i++) await sleep(1000);
    check("admin cancel of an order frees the slot", (await sql("select count(*)::int n from mercado_orders where matchday_id=$1 and status='pending'", [day.id]))[0].n === 0);
    await submit();

    // ── Extend, then freeze ────────────────────────────────────────────────────────────────────────
    await s.goto("/admin/mercato");
    await s.click("Prolonger"); await s.set("dialog[open] [name=hours]", 2); await s.click("Prolonger", "dialog[open] form");
    await s.waitText("Mercato prolongé");
    const [ext] = await sql("select mercato_closes_at from matchdays where id=$1", [day.id]);
    check("extending sets a closing time in the future", new Date(ext.mercato_closes_at) > new Date(Date.now() + 90 * 60_000), ext.mercato_closes_at);

    await s.goto("/admin/mercato");
    await s.click("Fermer le mercato et geler le site"); await s.click("Fermer et geler", "dialog[open]");
    await s.waitText("Site gelé");
    const [frozen] = await sql("select d.mercato_stage, (select frozen from site_state) f from matchdays d where d.id=$1", [day.id]);
    check("freezing sets stage 'frozen' and freezes the site", frozen.mercato_stage === "frozen" && frozen.f === true, JSON.stringify(frozen));
    await player.goto("/mon-equipe");
    check("managers see the freeze banner on every page", await player.has("Site gelé"));
    await assertRejects(() => sql("insert into mercado_orders(squad_id,matchday_id,sold_player_id,bought_player_id,submitted_sold_value,submitted_bought_value,submitted_tax,fixed_commission) select $1,$2,sold.id,bought.id,1,1,0,0 from (select id from players where id<>$3 limit 1) sold, (select id from players where id<>$4 and id<>$3 limit 1) bought", [qa.squad, day.id, trade.sold, trade.bought]), /MERCADO_NOT_OPEN/, "no new order once frozen (database guard)");

    // ── Value preview, update, rollback ────────────────────────────────────────────────────────────
    await s.goto("/admin/mercato");
    check("frozen stage shows the per-player value table", (await s.has("Valeur avant")) && (await s.has("Valeur après")) && (await s.has("Effectif initial")));
    const before = await budgetOf(qa.gamer);
    await s.click("Mettre à jour les valeurs"); await s.click("Mettre à jour", "dialog[open]");
    await s.waitText("ordre(s) exécuté(s)");
    check("updating executes the order: squad swapped, budget moved, stage 'updated'", (await owns(qa.squad, trade.bought)) && !(await owns(qa.squad, trade.sold)) && (await budgetOf(qa.gamer)) !== before && (await sql("select mercato_stage from matchdays where id=$1", [day.id]))[0].mercato_stage === "updated");
    await s.goto("/admin/mercato");
    await s.click("Annuler le mercato"); await s.click("Annuler le mercato", "dialog[open]");
    await s.waitText("remis en attente");
    check("rollback restores squad and budget and returns to the frozen stage", (await owns(qa.squad, trade.sold)) && !(await owns(qa.squad, trade.bought)) && Math.abs((await budgetOf(qa.gamer)) - before) < 0.01 && (await sql("select mercato_stage from matchdays where id=$1", [day.id]))[0].mercato_stage === "frozen");

    // ── Reopen, drop the order, freeze, update (empty), thaw ───────────────────────────────────────
    await s.goto("/admin/mercato");
    await s.click("Réouvrir le mercato"); await s.click("Réouvrir", "dialog[open]");
    await s.waitText("rouvert");
    check("reopening returns to 'open' and unfreezes the site", (await sql("select d.mercato_stage, (select frozen from site_state) f from matchdays d where d.id=$1", [day.id]))[0].f === false);
    await sql("update mercado_orders set status='cancelled' where matchday_id=$1 and status='pending'", [day.id]);
    await s.goto("/admin/mercato");
    await s.click("Fermer le mercato et geler le site"); await s.click("Fermer et geler", "dialog[open]"); await s.waitText("Site gelé");
    await s.goto("/admin/mercato");
    await s.click("Mettre à jour les valeurs"); await s.click("Mettre à jour", "dialog[open]"); await s.waitText("exécuté");
    await s.goto("/admin/mercato");
    await s.click("Dégeler le site"); await s.click("Dégeler", "dialog[open]");
    await s.waitText("Site dégelé");
    const [thawed] = await sql("select d.status, d.mercato_stage, d.thaw_at, (select frozen from site_state) f from matchdays d where d.id=$1", [day.id]);
    check("thawing closes the Mercato matchday and lifts the freeze", thawed.status === "closed" && thawed.mercato_stage === "thawed" && thawed.thaw_at !== null && thawed.f === false, JSON.stringify(thawed));
    await s.goto("/admin/mercato");
    check("after the thaw the page shows the free-transfer phase again", await s.has("Ouvrir le mercato"));
    await player.goto("/mon-equipe");
    check("the freeze banner is gone for managers", !(await player.has("Site gelé")));
  } finally {
    // Put the QA matchday back exactly as it was.
    await sql("delete from mercado_order_executions where run_id in (select id from mercado_runs where matchday_id=$1)", [day.id]);
    await sql("delete from mercado_runs where matchday_id=$1", [day.id]);
    await sql("delete from mercado_orders where matchday_id=$1", [day.id]);
    await sql("delete from matchday_squad_snapshots where matchday_id=$1", [day.id]);
    await sql("update matchdays set status=$2, mercato_opens_at=$3, mercato_closes_at=$4, thaw_at=$5 where id=$1", [day.id, original.status, original.mercato_opens_at, original.mercato_closes_at, original.thaw_at]);
    await sql("update matchdays set mercato_stage=$2 where id=$1", [day.id, original.mercato_stage]);
    await sql("update site_state set frozen=false, reason=null");
    player.close();
  }
  check("the QA matchday is restored to its original state", (await sql("select status, mercato_stage from matchdays where id=$1", [day.id]))[0].status === original.status);
}

async function assertRejects(fn, pattern, label) { try { await fn(); check(label, false, "did not throw"); } catch (e) { check(label, pattern.test(String(e?.message ?? e)), String(e?.message ?? e).slice(0, 120)); } }
