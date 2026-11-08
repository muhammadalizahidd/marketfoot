import { applyCaptainMultiplier, calculatePlayerMatchEffect, distributeEarnings, type PlayerMatchInput } from "./earnings";
import { getRulesSettings } from "./settings";
import type { PlayerPosition } from "./types";

export type SettlementSnapshot = { snapshotId: string; gamerId: string; playerId: string; position: PlayerPosition; isStarter: boolean; isCaptain: boolean; clubId: string };
export type OfficialMatchContext = { isPostponed: boolean; goalsConceded?: number; teamResult?: "home_win" | "away_win" | "home_draw" | "away_draw" | "home_loss" | "away_loss" };
export type PlayerSettlementResult = { normalEffect: number; captainAdjustment: number; gamerEffect: number; budgetDelta: number; lockedAccountDelta: number; calculation: Record<string, number | boolean | string | null> };

/** PRD §11.4 team-result barème, read live from the active settings. */
export const teamResultEffects = {
  get home_win() { return getRulesSettings().teamResult.home_win; },
  get away_win() { return getRulesSettings().teamResult.away_win; },
  get home_draw() { return getRulesSettings().teamResult.home_draw; },
  get away_draw() { return getRulesSettings().teamResult.away_draw; },
  get home_loss() { return getRulesSettings().teamResult.home_loss; },
  get away_loss() { return getRulesSettings().teamResult.away_loss; },
} as Record<NonNullable<OfficialMatchContext["teamResult"]>, number>;

/**
 * Deterministic v3.2.0 settlement calculation. A postponed fixture is deferred:
 * it produces no original-matchday payout and remains visible for later settlement.
 */
export function calculateSettlementEffect(snapshot: SettlementSnapshot, input: PlayerMatchInput | null, match: OfficialMatchContext): PlayerSettlementResult | null {
  if (match.isPostponed) return null;
  const source: PlayerMatchInput = input ?? { started: false, minutesPlayed: 0, goals: 0, assists: 0, ownGoals: 0, yellowCards: 0, redCards: 0, penaltiesScored: 0, penaltiesMissed: 0, penaltiesSaved: 0, saves: 0, substitutionsOut: 0, goalsConceded: match.goalsConceded };
  // The selection state, not the football line-up, determines the source table's starter/substitute column.
  const normalEffect = calculatePlayerMatchEffect(snapshot.position, { ...source, started: snapshot.isStarter, goalsConceded: match.goalsConceded });
  const teamEffect = match.teamResult ? teamResultEffects[match.teamResult] : 0;
  const effectWithTeam = normalEffect + teamEffect;
  const gamerEffect = snapshot.isCaptain ? applyCaptainMultiplier(effectWithTeam) : effectWithTeam;
  const captainAdjustment = gamerEffect - effectWithTeam;
  const distribution = distributeEarnings(gamerEffect);
  return { normalEffect: effectWithTeam, captainAdjustment, gamerEffect, budgetDelta: distribution.budget, lockedAccountDelta: distribution.lockedAccount, calculation: { isStarter: snapshot.isStarter, isCaptain: snapshot.isCaptain, playerEffect: normalEffect, teamEffect, goalsConceded: match.goalsConceded ?? null, postponed: false } };
}

/** Result of a fixture from one club's point of view, used by the settlement barème (home/away matter). */
export function teamResultOf(isHome: boolean, goalsFor: number, goalsAgainst: number): NonNullable<OfficialMatchContext["teamResult"]> {
  if (goalsFor === goalsAgainst) return isHome ? "home_draw" : "away_draw";
  if (goalsFor > goalsAgainst) return isHome ? "home_win" : "away_win";
  return isHome ? "home_loss" : "away_loss";
}
