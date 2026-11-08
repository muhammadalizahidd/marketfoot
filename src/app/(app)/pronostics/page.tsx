import Link from "next/link";
import { redirect } from "next/navigation";

import { getLeagueData } from "@/data/repositories/league-repository";
import { getMySquad } from "@/data/repositories/squad-repository";
import { getCurrentUserId } from "@/lib/auth/session";
import { one } from "@/lib/supabase/relation";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { getMatchOutcome } from "@/rules";
import { PredictionWorkspace } from "@/features/predictions/prediction-workspace";

export default async function PredictionsPage({ searchParams }: { searchParams: Promise<{ season?: string; day?: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/connexion");
  const query = await searchParams;
  const [data, squad] = await Promise.all([getLeagueData(query.season, query.day), getMySquad(userId)]);

  if (!squad) {
    return <main className="app-page"><section className="empty-state"><h1>Votre équipe n’est pas encore créée</h1><p>Composez votre effectif de 19 joueurs pour commencer.</p><Link className="primary-action" href="/onboarding">Créer mon équipe</Link></section></main>;
  }

  const matches = data.matches.filter((match) => match.matchday_id === data.day?.id);
  const db = await createSupabaseServerClient();
  const { data: predictions, error } = matches.length
    ? await db.from("predictions").select("match_id,choice").eq("gamer_id", userId).in("match_id", matches.map((match) => match.id))
    : { data: [], error: null };
  const { data: resultRows } = data.day ? await db.from("prediction_results").select("eligible_matches,correct_predictions,result_pct,average_pct,earnings,budget_delta,locked_account_delta").eq("gamer_id", userId).eq("matchday_id", data.day.id).is("reversed_at", null).maybeSingle() : { data: null };
  const choices = new Map((predictions ?? []).map((prediction) => [prediction.match_id, prediction.choice]));
  const clubs = new Map(data.clubs.map((club) => [club.id, club.name]));
  const now = Date.now();
  const selectedDayIndex = data.days.findIndex((day) => day.id === data.day?.id);
  const matchdayHref = (dayId?: string) => dayId ? `/pronostics?season=${encodeURIComponent(data.season?.id ?? "")}&day=${encodeURIComponent(dayId)}` : undefined;
  // How many gamers hold each of my players (the "Possesseur" display mode).
  const ownedIds = (squad.squad_members ?? []).map((member) => member.player_id);
  const { data: holderRows } = ownedIds.length ? await createSupabaseAdminClient().from("squad_members").select("player_id").in("player_id", ownedIds) : { data: [] as { player_id: string }[] };
  const owners = new Map<string, number>();
  for (const row of holderRows ?? []) owners.set(row.player_id, (owners.get(row.player_id) ?? 0) + 1);
  const members = (squad.squad_members ?? []).map((member) => ({
    acquiredValue: Number(member.acquired_value),
    owners: owners.get(member.player_id) ?? 1,
    id: member.player_id,
    name: `${one(member.players)?.first_name ?? ""} ${one(member.players)?.last_name ?? ""}`.trim(),
    position: one(member.players)?.position ?? "—",
    value: Number(one(member.players)?.marketfoot_value ?? member.acquired_value),
    isStarter: member.is_starter,
    isCaptain: member.is_captain,
    clubName: one(one(member.players)?.clubs)?.name ?? "",
  }));

  if (error) return <main className="app-page"><section className="empty-state" role="alert">Les pronostics sont momentanément indisponibles. Réessayez plus tard.</section></main>;

  return <main className="app-page" style={{ padding: 0 }}><PredictionWorkspace
    members={members}
    matchdayNumber={data.day?.number}
    result={resultRows ? { correct: resultRows.correct_predictions, eligible: resultRows.eligible_matches, resultPct: Number(resultRows.result_pct), averagePct: Number(resultRows.average_pct), earnings: Number(resultRows.earnings), budget: Number(resultRows.budget_delta), locked: Number(resultRows.locked_account_delta) } : undefined}
    previousMatchdayHref={matchdayHref(data.days[selectedDayIndex - 1]?.id)}
    nextMatchdayHref={matchdayHref(data.days[selectedDayIndex + 1]?.id)}
    fixtures={matches.map((match) => ({
      id: match.id,
      homeClub: clubs.get(match.home_club_id) ?? "Club domicile",
      awayClub: clubs.get(match.away_club_id) ?? "Club extérieur",
      kickoffAt: match.kickoff_at,
      choice: choices.get(match.id),
      postponed: match.is_postponed,
      outcome: match.home_score !== null && match.away_score !== null && !match.is_postponed ? getMatchOutcome(match.home_score, match.away_score) : undefined,
      score: match.home_score !== null && match.away_score !== null ? `${match.home_score}-${match.away_score}` : undefined,
      closed: match.is_postponed || new Date(match.kickoff_at).getTime() <= now || match.home_score !== null || match.away_score !== null,
    }))}
  /></main>;
}
