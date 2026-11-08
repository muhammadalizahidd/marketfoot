export type LeagueResult = { home_club_id: string; away_club_id: string; home_score: number | null; away_score: number | null; is_postponed: boolean; kickoff_at: string };
export type Standing = { id: string; name: string; played: number; won: number; drawn: number; lost: number; goalsFor: number; goalsAgainst: number; points: number; form: string[] };

/** Provisional display tiebreak: points, goal difference, goals scored, club name. */
export function calculateStandings(clubs: { id: string; name: string }[], matches: LeagueResult[], scope: "all" | "home" | "away" = "all"): Standing[] {
  const rows = new Map(clubs.map(club => [club.id, { ...club, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0, form: [] as string[] }]));
  for (const match of [...matches].sort((a,b) => a.kickoff_at.localeCompare(b.kickoff_at))) {
    if (match.is_postponed || match.home_score === null || match.away_score === null) continue;
    for (const home of [true,false]) {
      if ((scope === "home" && !home) || (scope === "away" && home)) continue;
      const row = rows.get(home ? match.home_club_id : match.away_club_id);
      if (!row) continue;
      const scored = home ? match.home_score : match.away_score;
      const conceded = home ? match.away_score : match.home_score;
      row.played++; row.goalsFor += scored; row.goalsAgainst += conceded;
      if (scored > conceded) { row.won++; row.points += 3; row.form.push("V"); }
      else if (scored === conceded) { row.drawn++; row.points++; row.form.push("N"); }
      else { row.lost++; row.form.push("D"); }
      row.form = row.form.slice(-5);
    }
  }
  return [...rows.values()].sort((a,b) => b.points-a.points || (b.goalsFor-b.goalsAgainst)-(a.goalsFor-a.goalsAgainst) || b.goalsFor-a.goalsFor || a.name.localeCompare(b.name,"fr"));
}
