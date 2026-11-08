import { ensureRulesSettings } from "@/services/rules-settings";
import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { calculateGamerResultPct, calculateMatchdayAveragePct, calculatePredictionEarnings, calculateSettlementEffect, getMatchOutcome, type PlayerMatchInput, type SettlementSnapshot } from "@/rules";
import { one } from "@/lib/supabase/relation";
import { foldBonusIntoEffects, getRulesSettings, isBonusSuccessful, type BonusPlayer } from "@/rules";

type ReviewEffect = { bonusAdjustment?: number; snapshotId: string; gamerId: string; playerId: string; normalEffect: number; captainAdjustment: number; gamerEffect: number; budgetDelta: number; lockedAccountDelta: number; calculation: Record<string, number | boolean | string | null>; playerName: string; squadName: string };
type PredictionEffect = { gamerId: string; squadName: string; eligible: number; correct: number; resultPct: number; averagePct: number; x: number; rawG: number; earnings: number; budgetDelta: number; lockedAccountDelta: number };
type BonusEffect = { playId: string; gamerId: string; squadName: string; bonusId: string; succeeded: boolean; amount: number };
type Review = { bonuses: BonusEffect[]; settlementId: string; matchdayId: string; effects: ReviewEffect[]; predictions: PredictionEffect[]; playerValues: {playerId:string; normalEffect:number}[]; deferredPlayers: number; totals: { gross: number; budget: number; locked: number } };

function teamResult(homeScore: number, awayScore: number, isHome: boolean) {
  if (homeScore === awayScore) return isHome ? "home_draw" as const : "away_draw" as const;
  const won = isHome ? homeScore > awayScore : awayScore > homeScore;
  return won ? (isHome ? "home_win" as const : "away_win" as const) : (isHome ? "home_loss" as const : "away_loss" as const);
}

/** PRD §12: eligible = non-postponed matches; a forgotten prediction is wrong; the average covers every gamer with a frozen squad (provisional policy). */
export function buildPredictionEffects(matches: { id: string; home_score: number | null; away_score: number | null; is_postponed: boolean }[], predictions: { gamer_id: string; match_id: string; choice: string }[], gamers: { gamerId: string; squadName: string }[]): PredictionEffect[] {
  const eligible = matches.filter((match) => !match.is_postponed && match.home_score !== null && match.away_score !== null);
  if (!eligible.length || !gamers.length) return [];
  const outcomes = new Map(eligible.map((match) => [match.id, getMatchOutcome(match.home_score!, match.away_score!)]));
  const correctByGamer = new Map<string, number>();
  for (const prediction of predictions) if (outcomes.get(prediction.match_id) === prediction.choice) correctByGamer.set(prediction.gamer_id, (correctByGamer.get(prediction.gamer_id) ?? 0) + 1);
  const results = gamers.map((gamer) => ({ ...gamer, correct: correctByGamer.get(gamer.gamerId) ?? 0 }));
  const percents = results.map((result) => calculateGamerResultPct(result.correct, eligible.length));
  const average = calculateMatchdayAveragePct(percents);
  return results.map((result, index) => ({ gamerId: result.gamerId, squadName: result.squadName, eligible: eligible.length, correct: result.correct, ...calculatePredictionEarnings(percents[index], average) }));
}

export async function buildSettlementReview(settlementId: string): Promise<Review> {
  await ensureRulesSettings();
  const admin = createSupabaseAdminClient();
  const { data: settlement, error: settlementError } = await admin.from("matchday_settlements").select("id,matchday_id,status").eq("id", settlementId).single();
  if (settlementError || !settlement) throw new Error("Règlement introuvable.");
  if (settlement.status !== "pending") throw new Error("Ce règlement ne peut plus être exécuté.");
  const [{ data: snapshots }, { data: matches }] = await Promise.all([
    admin.from("matchday_squad_snapshots").select("id,gamer_id,squad_id,player_id,club_id,position,is_starter,is_captain,squads(name),players(first_name,last_name)").eq("matchday_id", settlement.matchday_id),
    admin.from("matches").select("id,home_club_id,away_club_id,home_score,away_score,is_postponed").eq("matchday_id", settlement.matchday_id),
  ]);
  if (!snapshots?.length) throw new Error("Aucun instantané d’équipe n’existe. Fermez d’abord la journée.");
  const playableMatches = (matches ?? []).filter((match) => !match.is_postponed);
  if (playableMatches.some((match) => match.home_score === null || match.away_score === null)) throw new Error("Tous les résultats non reportés doivent être renseignés avant le règlement.");
  const matchIds = (matches ?? []).map((match) => match.id);
  const { data: stats } = matchIds.length ? await admin.from("player_match_stats").select("match_id,player_id,started,minutes_played,goals,assists,own_goals,yellow_cards,red_cards,penalties_scored,penalties_missed,penalties_saved,saves,substitutions_out,substitutions_in,stoppage_time_goals").in("match_id", matchIds) : { data: [] };
  const statsByPlayer = new Map((stats ?? []).map((stat) => [stat.player_id, stat]));
  const effects: ReviewEffect[] = []; let deferredPlayers = 0;
  const playerValues = new Map<string,{playerId:string;normalEffect:number}>();
  for (const source of snapshots) {
    const snapshot: SettlementSnapshot = { snapshotId: source.id, gamerId: source.gamer_id, playerId: source.player_id, clubId: source.club_id, position: source.position, isStarter: source.is_starter, isCaptain: source.is_captain };
    const match = (matches ?? []).find((item) => item.home_club_id === source.club_id || item.away_club_id === source.club_id);
    if (!match) continue;
    const isHome = match.home_club_id === source.club_id;
    const input: PlayerMatchInput | null = statsByPlayer.has(source.player_id) ? (() => { const stat = statsByPlayer.get(source.player_id)!; return { started: stat.started, minutesPlayed: stat.minutes_played, goals: stat.goals, assists: stat.assists, ownGoals: stat.own_goals, yellowCards: stat.yellow_cards, redCards: stat.red_cards, penaltiesScored: stat.penalties_scored, penaltiesMissed: stat.penalties_missed, penaltiesSaved: stat.penalties_saved, saves: stat.saves, substitutionsOut: stat.substitutions_out }; })() : null;
    const result = calculateSettlementEffect(snapshot, input, { isPostponed: match.is_postponed, goalsConceded: isHome ? match.away_score ?? undefined : match.home_score ?? undefined, teamResult: match.home_score === null || match.away_score === null ? undefined : teamResult(match.home_score, match.away_score, isHome) });
    if (!result) { deferredPlayers += 1; continue; }
    // A football player's global value is independent of how many gamers own him
    // and of those gamers' starter/captain selections.
    const official = calculateSettlementEffect({...snapshot,isStarter:input?.started??false,isCaptain:false},input,{isPostponed:false,goalsConceded:isHome?match.away_score??undefined:match.home_score??undefined,teamResult:match.home_score===null||match.away_score===null?undefined:teamResult(match.home_score,match.away_score,isHome)});
    if(official) playerValues.set(source.player_id,{playerId:source.player_id,normalEffect:official.normalEffect});
    effects.push({ ...result, snapshotId: source.id, gamerId: source.gamer_id, playerId: source.player_id, playerName: `${one(source.players)?.first_name ?? ""} ${one(source.players)?.last_name ?? ""}`.trim(), squadName: one(source.squads)?.name ?? "Équipe" });
  }
  const { data: predictionRows } = matchIds.length ? await admin.from("predictions").select("gamer_id,match_id,choice").in("match_id", matchIds) : { data: [] };
  const gamers = [...new Map(snapshots.map((source) => [source.gamer_id, { gamerId: source.gamer_id, squadName: one(source.squads)?.name ?? "Équipe" }])).values()];
  const predictionEffects = buildPredictionEffects(matches ?? [], predictionRows ?? [], gamers);
  // Bonus (PRD §6.4): +gainPct of the starters' primes when the chosen event happened. The amount is folded into the gamer's
  // largest starter effect so every settlement row stays balanced (budget + locked = gamer effect) and rollbacks reverse it.
  const { data: plays } = await admin.from("bonus_plays").select("id,squad_id,bonus_id").eq("matchday_id", settlement.matchday_id);
  const enabledBonuses = new Set(getRulesSettings().bonus.list.filter((item) => item.enabled).map((item) => item.id));
  const gamerOfSquad = new Map(snapshots.map((source) => [source.squad_id, { gamerId: source.gamer_id, squadName: one(source.squads)?.name ?? "Équipe" }]));
  const bonuses: BonusEffect[] = [];
  for (const play of plays ?? []) {
    const owner = gamerOfSquad.get(play.squad_id);
    if (!owner || !enabledBonuses.has(play.bonus_id as never)) continue;
    const lineup: BonusPlayer[] = snapshots.filter((source) => source.gamer_id === owner.gamerId).flatMap((source) => {
      const match = (matches ?? []).find((item) => item.home_club_id === source.club_id || item.away_club_id === source.club_id);
      if (!match) return [];
      const stat = statsByPlayer.get(source.player_id);
      const home = match.home_club_id === source.club_id;
      return [{ position: source.position, isStarter: source.is_starter, played: (stat?.minutes_played ?? 0) > 0, startedMatch: stat?.started ?? false, goals: stat?.goals ?? 0, assists: stat?.assists ?? 0, penaltiesScored: stat?.penalties_scored ?? 0, stoppageTimeGoals: stat?.stoppage_time_goals ?? 0, teamGoalsFor: (home ? match.home_score : match.away_score) ?? 0, teamGoalsAgainst: (home ? match.away_score : match.home_score) ?? 0, postponed: match.is_postponed }];
    });
    const succeeded = isBonusSuccessful(play.bonus_id as never, lineup);
    const amount = foldBonusIntoEffects(effects, owner.gamerId, play.bonus_id, succeeded);
    bonuses.push({ playId: play.id, gamerId: owner.gamerId, squadName: owner.squadName, bonusId: play.bonus_id, succeeded, amount });
  }
  const totals = effects.reduce((total, effect) => ({ gross: total.gross + effect.gamerEffect, budget: total.budget + effect.budgetDelta, locked: total.locked + effect.lockedAccountDelta }), { gross: 0, budget: 0, locked: 0 });
  return { bonuses, settlementId, matchdayId: settlement.matchday_id, effects, predictions: predictionEffects, playerValues:[...playerValues.values()], deferredPlayers, totals };
}

export async function executeSettlement(actorId: string, settlementId: string) {
  await ensureRulesSettings();
  const review = await buildSettlementReview(settlementId);
  const { error } = await createSupabaseAdminClient().rpc("commit_matchday_settlement", { p_actor_id: actorId, p_settlement_id: settlementId, p_effects: {effects:review.effects,playerValues:review.playerValues,predictions:review.predictions} });
  if (error) throw new Error("Le règlement n’a pas pu être validé de façon atomique.");
  for (const bonus of review.bonuses) await createSupabaseAdminClient().from("bonus_plays").update({ succeeded: bonus.succeeded, bonus_amount: bonus.amount }).eq("id", bonus.playId);
  return review;
}

export async function rollbackSettlement(actorId: string, settlementId: string, reason: string) {
  const { error } = await createSupabaseAdminClient().rpc("rollback_matchday_settlement", { p_actor_id: actorId, p_settlement_id: settlementId, p_reason: reason });
  if (error) throw new Error("Le retour arrière du règlement a échoué.");
  const { data: settlement } = await createSupabaseAdminClient().from("matchday_settlements").select("matchday_id").eq("id", settlementId).single();
  if (settlement) await createSupabaseAdminClient().from("bonus_plays").update({ succeeded: null, bonus_amount: null }).eq("matchday_id", settlement.matchday_id);
}
