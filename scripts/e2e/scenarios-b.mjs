import { check, sleep, sql } from "./harness.mjs";

/** A throwaway draft season with 6 real clubs, so Saisie can be exercised without touching the live QA season. */
async function throwawaySeason(name) {
  await sql("delete from seasons where name=$1", [name]);
  const [season] = await sql("insert into seasons(name,starts_on,ends_on,status) values($1,'2030-08-01','2031-06-01','draft') returning id", [name]);
  const clubs = await sql("select id, name from clubs order by name limit 6");
  for (const club of clubs) await sql("insert into season_clubs(season_id,club_id) values($1,$2)", [season.id, club.id]);
  return { id: season.id, clubs };
}
const cleanSeason = async (id) => {
  await sql("delete from player_match_stats where match_id in (select m.id from matches m join matchdays d on d.id=m.matchday_id where d.season_id=$1)", [id]);
  await sql("delete from matches where matchday_id in (select id from matchdays where season_id=$1)", [id]);
  await sql("delete from matchdays where season_id=$1", [id]);
  await sql("delete from seasons where id=$1", [id]);
};

export async function saisie(s) {
  console.log("\n# Saisie");
  const season = await throwawaySeason("E2E Saisie");
  const [a, b, c, d, e, f] = season.clubs;
  try {
    await s.goto(`/admin/saisie?season=${season.id}&day=1`);
    check("Saisie shows the J1–J34 grid and the Déroulé panel", (await s.has("J34")) && (await s.has("Ouverture du mercato")) && (await s.has("Gel avant le coup d’envoi")));
    check("the freeze offset is shown read-only (2 h)", (await s.ev(`document.querySelector('input[aria-label="Gel avant le coup d’envoi"]').disabled && document.querySelector('input[aria-label="Gel avant le coup d’envoi"]').value`)) === "2 h");

    // Same club twice in one matchday is refused.
    await s.set('[name="row.0.date"]', "2030-09-05"); await s.set('[name="row.0.time"]', "20:45"); await s.set('[name="row.0.home"]', a.id); await s.set('[name="row.0.away"]', b.id);
    await s.set('[name="row.1.date"]', "2030-09-06"); await s.set('[name="row.1.time"]', "17:00"); await s.set('[name="row.1.home"]', a.id); await s.set('[name="row.1.away"]', c.id);
    await s.click("Enregistrer", "#saisie-form"); await s.waitText("ne peut jouer qu’un match");
    check("a team cannot play twice in the same matchday", true);
    await s.set('[name="row.1.home"]', b.id); await s.set('[name="row.1.away"]', b.id);
    await s.click("Enregistrer", "#saisie-form"); await s.waitText("contre elle-même");
    check("a team cannot play itself", true);
    check("failed saves leave nothing half-written", (await sql("select count(*)::int n from matches m join matchdays d on d.id=m.matchday_id where d.season_id=$1", [season.id]))[0].n === 0);

    // Valid schedule with the mercato dates.
    await s.set('[name="row.1.home"]', c.id); await s.set('[name="row.1.away"]', d.id);
    await s.set('[name="row.2.date"]', "2030-09-06"); await s.set('[name="row.2.time"]', "21:00"); await s.set('[name="row.2.home"]', e.id); await s.set('[name="row.2.away"]', f.id);
    const times = await s.ev(`JSON.stringify(['mercato_open','mercato_close','thaw'].map((n) => document.querySelector('[name=' + n + '_time]').value))`);
    check("Mercato times default from the calendar in Paramètres (PRD §7.5)", times === JSON.stringify(["20:00", "20:00", "20:30"]), times);
    await s.set('[name="mercato_open_date"]', "2030-09-09"); await s.set('[name="mercato_close_date"]', "2030-09-10"); await s.set('[name="thaw_date"]', "2030-09-10");
    await s.click("Enregistrer", "#saisie-form"); await s.waitText("Journée 1 enregistrée (3 matchs)");
    const [day] = await sql("select id, status, mercato_opens_at, mercato_closes_at, thaw_at from matchdays where season_id=$1 and number=1", [season.id]);
    const matches = await sql("select id, kickoff_at, home_club_id, away_club_id from matches where matchday_id=$1 order by kickoff_at", [day.id]);
    check("matchday and 3 matches are created in draft", day.status === "draft" && matches.length === 3, JSON.stringify([day.status, matches.length]));
    check("Europe/Paris times are stored as UTC (20:45 CEST → 18:45Z)", new Date(matches[0].kickoff_at).toISOString() === "2030-09-05T18:45:00.000Z", new Date(matches[0].kickoff_at).toISOString());
    check("Mercato open / close / thaw are saved (Paris time → UTC)", new Date(day.mercato_opens_at).toISOString() === "2030-09-09T18:00:00.000Z" && new Date(day.thaw_at).toISOString() === "2030-09-10T18:30:00.000Z", JSON.stringify([day.mercato_opens_at, day.thaw_at]));

    // Postpone the second match to a new date.
    await s.goto(`/admin/saisie?season=${season.id}&day=1`);
    await s.ev(`(() => { const row = document.querySelectorAll('.ad-match')[1]; [...row.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Reporter').click(); return true; })()`);
    await s.set("dialog[open] [name=date]", "2030-09-20"); await s.set("dialog[open] [name=time]", "19:00");
    await s.click("Reporter", "dialog[open] form"); await s.waitText("Match reporté");
    const [post] = await sql("select is_postponed, kickoff_at from matches where id=$1", [matches[1].id]);
    check("postponing flags the match and moves its date", post.is_postponed === true && new Date(post.kickoff_at).toISOString() === "2030-09-20T17:00:00.000Z", JSON.stringify(post));

    // Delete the third match from the list.
    await s.ev(`(() => { const dlg = document.querySelector('dialog:has(input[name=id][value="${matches[2].id}"])'); let el = dlg.previousElementSibling; while (el && el.tagName !== 'BUTTON') el = el.previousElementSibling; el.click(); return true; })()`);
    await s.click("Supprimer", "dialog[open]"); await sleep(3500);
    check("a match without a sheet can be deleted from the grid", (await sql("select count(*)::int n from matches where id=$1", [matches[2].id]))[0].n === 0);

    // Publish: draft → open.
    await s.goto(`/admin/saisie?season=${season.id}&day=1`);
    await s.click("Publier"); await s.click("Publier", "dialog[open]"); await s.waitText("publiée");
    check("Publier opens a draft matchday to managers", (await sql("select status from matchdays where id=$1", [day.id]))[0].status === "open");

    // Match sheet.
    const matchId = matches[0].id;
    await s.goto(`/admin/saisie/1/${matchId}`);
    check("match sheet shows both teams and an empty-state hint", (await s.has(a.name)) && (await s.has("Aucun joueur")));
    await s.click("Pré-remplir avec les joueurs des deux clubs"); await s.waitText("joueur(s) ajouté(s)");
    await s.goto(`/admin/saisie/1/${matchId}`);
    const rows = await s.ev(`document.querySelectorAll('tbody tr input[name$=".minutes"]').length`);
    const [expected] = await sql("select count(*)::int n from players where is_active and club_id in ($1,$2)", [a.id, b.id]);
    check("pre-fill adds every active player of both clubs", rows === expected.n && rows > 0, `${rows} vs ${expected.n}`);

    const first = await s.ev(`(() => { const row = document.querySelector('tbody tr input[name$=".minutes"]'); return row.name.split('.')[1]; })()`);
    const away = await s.ev(`(() => { const rows = document.querySelectorAll('.ad-grid-2 .ad-card')[1].querySelectorAll('tbody tr input[name$=".minutes"]'); return rows[0].name.split('.')[1]; })()`);
    await s.set('[name="home_score"]', 2); await s.set('[name="away_score"]', 1);
    await s.set(`[name="s.${first}.started"]`, true); await s.set(`[name="s.${first}.minutes"]`, 90); await s.set(`[name="s.${first}.goals"]`, 2); await s.set(`[name="s.${first}.penalties_scored"]`, 1);
    await s.set(`[name="s.${away}.started"]`, true); await s.set(`[name="s.${away}.minutes"]`, 70); await s.set(`[name="s.${away}.yellow_cards"]`, 1);
    const primes = await s.ev(`(() => { const row = document.querySelector('[name="s.${first}.minutes"]').closest('tr'); return row.querySelectorAll('td')[row.querySelectorAll('td').length - 2].innerText; })()`);
    check("primes are computed live while typing", /€/.test(primes) && primes !== "—", primes);
    await s.click("Enregistrer en tant que brouillon"); await s.waitText("Brouillon enregistré");
    let [m] = await sql("select home_score, away_score, sheet_status from matches where id=$1", [matchId]);
    check("draft saves the score without validating", m.home_score === 2 && m.away_score === 1 && m.sheet_status === "draft");
    await s.click("Valider"); await s.waitText("Feuille de match validée");
    [m] = await sql("select sheet_status, is_postponed from matches where id=$1", [matchId]);
    const [stat] = await sql("select started, minutes_played, goals, penalties_scored, substitutions_out from player_match_stats where match_id=$1 and player_id=$2", [matchId, first]);
    const [awayStat] = await sql("select yellow_cards, substitutions_out from player_match_stats where match_id=$1 and player_id=$2", [matchId, away]);
    check("Valider marks the sheet validated", m.sheet_status === "validated");
    check("player statistics are stored", stat.started && stat.minutes_played === 90 && stat.goals === 2 && stat.penalties_scored === 1, JSON.stringify(stat));
    check("'Remplacé' is derived (starter off before 90' without a red card)", awayStat.yellow_cards === 1 && awayStat.substitutions_out === 1 && stat.substitutions_out === 0, JSON.stringify([awayStat, stat]));

    // Remove a row and save again.
    await s.goto(`/admin/saisie/1/${matchId}`);
    await s.ev(`(() => { const row = document.querySelector('[name="s.${first}.minutes"]').closest('tr'); row.querySelector('button').click(); return true; })()`);
    await s.click("Valider"); await s.waitText("Feuille de match validée");
    check("removing a row deletes that player's line", (await sql("select count(*)::int n from player_match_stats where match_id=$1 and player_id=$2", [matchId, first]))[0].n === 0);

    // Settled matchdays lock the sheet.
    await sql("update matchdays set status='settled' where id=$1", [day.id]);
    await s.goto(`/admin/saisie/1/${matchId}`);
    check("a settled matchday locks the match sheet", (await s.has("Cette journée est réglée")) && (await s.ev(`document.querySelector('[name="home_score"]').disabled`)));
    // The grid shows the finished matches as red days.
    await sql("update matches set kickoff_at=now()-interval '1 day' where id=$1", [matchId]);
    await s.goto(`/admin/saisie?season=${season.id}&day=1`);
    check("a finished day is shown in red on the grid", await s.ev(`!!document.querySelector('.ad-day--todo, .ad-day--done')`));
  } finally { await cleanSeason(season.id); }
}
