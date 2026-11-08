import { check, sleep, sql } from "./harness.mjs";

const money = (n) => Math.round(Number(n) * 100) / 100;

/**
 * Full settlement round-trip on a throwaway season using the real QA gamer squads:
 * close → publish → review (UI) → execute with a played bonus → verify payouts and bonus maths → roll back → verify restore.
 * Test rows that cannot be deleted (ledger / settlement history) stay behind in the TEST project under the season "E2E Settle".
 */
export async function settlement(s) {
  console.log("\n# Settlement + bonus");
  const [admin] = await sql("select id from profiles where username='QA_Admin'");
  const [qa] = await sql("select p.id gamer, s.id squad, s.name from profiles p join squads s on s.gamer_id=p.id where p.username='QA_Claude'");
  // The QA squad may have no flagged line-up (the app then falls back to a default 1-4-3-3): flag one for the test and restore later.
  const originalFlags = await sql("select player_id, is_starter, is_captain from squad_members where squad_id=$1", [qa.squad]);
  if (!originalFlags.some((row) => row.is_starter)) {
    for (const [position, count] of [["GK", 1], ["DF", 4], ["MF", 3], ["FW", 3]]) {
      await sql("update squad_members set is_starter=true where squad_id=$1 and player_id in (select sm.player_id from squad_members sm join players p on p.id=sm.player_id where sm.squad_id=$1 and p.position=$2 limit $3)", [qa.squad, position, count]);
    }
  }
  const restoreFlags = async () => { for (const row of originalFlags) await sql("update squad_members set is_starter=$3, is_captain=$4 where squad_id=$1 and player_id=$2", [qa.squad, row.player_id, row.is_starter, row.is_captain]); };
  const starters = await sql("select sm.player_id, p.club_id, p.position from squad_members sm join players p on p.id=sm.player_id where sm.squad_id=$1 and sm.is_starter order by p.club_id", [qa.squad]);
  const byClub = new Map(); for (const st of starters) byClub.set(st.club_id, [...(byClub.get(st.club_id) ?? []), st]);
  const ranked = [...byClub.entries()].sort((a, b) => b[1].length - a[1].length);
  const [clubX, startersX] = ranked[0]; const [clubY, startersY] = ranked[1] ?? ranked[0];
  check("QA_Claude has starters in two clubs (fixture sanity)", Boolean(clubX && clubY && startersX.length));

  await sql("delete from bonus_plays where squad_id=$1 and matchday_id in (select d.id from matchdays d join seasons s on s.id=d.season_id where s.name='E2E Settle')", [qa.squad]);
  let [season] = await sql("select id from seasons where name='E2E Settle'");
  if (season) {
    const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
    await sql("update seasons set name=$2 where id=$1", [season.id, `E2E Settle (archived ${stamp})`]);
  }
  [season] = await sql("insert into seasons(name,starts_on,ends_on,status) values('E2E Settle','2029-08-01','2030-06-01','draft') returning id");
  for (const c of [clubX, clubY]) await sql("insert into season_clubs(season_id,club_id) values($1,$2)", [season.id, c]);
  const [day] = await sql("insert into matchdays(season_id,number,status) values($1,1,'open') returning id", [season.id]);
  const [match] = await sql("insert into matches(matchday_id,home_club_id,away_club_id,kickoff_at,home_score,away_score,sheet_status) values($1,$2,$3,now()-interval '2 days',1,0,'validated') returning id", [day.id, clubX, clubY]);
  for (const [i, st] of [...startersX, ...startersY].entries()) {
    await sql("insert into player_match_stats(match_id,player_id,started,minutes_played,goals,penalties_scored) values($1,$2,true,90,$3,$4)", [match.id, st.player_id, i === 0 ? 1 : 0, i === 0 ? 1 : 0]);
  }
  await sql("insert into bonus_plays(squad_id,matchday_id,season_id,bonus_id) values($1,$2,$3,'turpin')", [qa.squad, day.id, season.id]);
  const before = (await sql("select budget, blocked_account from gamer_finances where gamer_id=$1", [qa.gamer]))[0];
  await sql("select public.admin_transition_matchday($1,$2,'mercado')", [admin.id, day.id]);
  await sql("select public.admin_transition_matchday($1,$2,'closed')", [admin.id, day.id]);
  check("closing the matchday snapshots the squads", (await sql("select count(*)::int n from matchday_squad_snapshots where matchday_id=$1", [day.id]))[0].n >= 11);

  // Publier → settlement request → review page.
  await s.goto(`/admin/saisie?season=${season.id}&day=1`);
  check("closed matchday offers 'Publier (règlement)'", await s.has("Publier (règlement)"));
  await s.click("Publier (règlement)"); await s.click("Publier", "dialog[open]");
  await s.waitFor("location.pathname === '/admin/saisie/publication'", 90000, "redirect to publication");
  await s.waitText("Revue des règlements");
  check("review shows the pending settlement", (await s.has("à revoir")) && (await s.has("Détail vérifiable")));
  check("review has a Bonus column and lists the played bonus", (await s.has("Bonus")) && (await s.has(qa.name)));
  const [pending] = await sql("select id from matchday_settlements where matchday_id=$1 and status='pending'", [day.id]);
  check("a pending settlement exists in the database", Boolean(pending));

  await s.click("Comptabiliser le règlement"); await s.click("Comptabiliser", "dialog[open]");
  await s.waitText("Règlement exécuté");
  const [done] = await sql("select status from matchday_settlements where id=$1", [pending.id]);
  check("execution completes the settlement and settles the matchday", done.status === "completed" && (await sql("select status from matchdays where id=$1", [day.id]))[0].status === "settled");

  const [play] = await sql("select succeeded, bonus_amount from bonus_plays where squad_id=$1 and matchday_id=$2", [qa.squad, day.id]);
  check("the Turpin bonus succeeded (a starter scored a penalty)", play.succeeded === true && Number(play.bonus_amount) > 0, JSON.stringify(play));
  const effects = await sql("select gamer_effect, calculation from settlement_player_effects where settlement_id=$1 and gamer_id=$2", [pending.id, qa.gamer]);
  const startersTotal = effects.filter((e) => e.calculation.isStarter === true).reduce((sum, e) => sum + Number(e.gamer_effect), 0);
  check("bonus = 10 % of the starters' primes (before the bonus)", Math.abs(Number(play.bonus_amount) - (startersTotal - Number(play.bonus_amount)) * 0.1) < 0.02, `${play.bonus_amount} vs ${(startersTotal - Number(play.bonus_amount)) * 0.1}`);
  const [gamerEffect] = await sql("select gross_effect, budget_delta, locked_account_delta from settlement_gamer_effects where settlement_id=$1 and gamer_id=$2", [pending.id, qa.gamer]);
  check("budget + locked account = gross effect (balanced)", Math.abs(Number(gamerEffect.budget_delta) + Number(gamerEffect.locked_account_delta) - Number(gamerEffect.gross_effect)) < 0.01);
  const after = (await sql("select budget, blocked_account from gamer_finances where gamer_id=$1", [qa.gamer]))[0];
  check("the manager's accounts moved by exactly the settlement amounts", Math.abs(Number(after.budget) - Number(before.budget) - Number(gamerEffect.budget_delta)) < 0.01 && Math.abs(Number(after.blocked_account) - Number(before.blocked_account) - Number(gamerEffect.locked_account_delta)) < 0.01);

  // Roll back from the history table.
  await s.goto("/admin/saisie/publication");
  await s.ev(`(() => { const row = [...document.querySelectorAll('tr')].find((r) => r.innerText.includes('Comptabilisé')); [...row.querySelectorAll('button')].find((b) => b.innerText.includes('Annuler et recalculer')).click(); return true; })()`);
  await s.set("dialog[open] textarea[name=reason]", "Test E2E : résultat à corriger");
  await s.click("Annuler le règlement", "dialog[open]");
  for (let i = 0; i < 60; i++) { if ((await sql("select status from matchday_settlements where id=$1", [pending.id]))[0].status === "reverted") break; await sleep(1000); }
  const restored = (await sql("select budget, blocked_account from gamer_finances where gamer_id=$1", [qa.gamer]))[0];
  check("rollback restores the manager's budget and locked account", Math.abs(Number(restored.budget) - Number(before.budget)) < 0.01 && Math.abs(Number(restored.blocked_account) - Number(before.blocked_account)) < 0.01, JSON.stringify([before, restored]));
  const [replay] = await sql("select succeeded, bonus_amount from bonus_plays where squad_id=$1 and matchday_id=$2", [qa.squad, day.id]);
  check("rollback re-opens the bonus play for the recalculation", replay.succeeded === null && replay.bonus_amount === null, JSON.stringify(replay));
  check("rollback is recorded (status reverted + audit)", (await sql("select status from matchday_settlements where id=$1", [pending.id]))[0].status === "reverted" && (await sql("select count(*)::int n from admin_audit_log where action like 'settlement%'"))[0].n >= 1);
  await restoreFlags();
  check("the QA squad's original line-up flags are restored", (await sql("select count(*)::int n from squad_members where squad_id=$1 and is_starter", [qa.squad]))[0].n === originalFlags.filter((r) => r.is_starter).length);
  // Leave the throwaway season out of the way.
  await sql("update seasons set status='finished' where id=$1", [season.id]);
  await sleep(200);
}
