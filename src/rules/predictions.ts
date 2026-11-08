import { getRulesSettings } from "./settings";
import { distributeEarnings } from "./earnings";

export type PredictionChoice = "1" | "N" | "2";
export type PredictionEarnings = { resultPct: number; averagePct: number; x: number; rawG: number; earnings: number; budgetDelta: number; lockedAccountDelta: number };

/** End-of-match result: 1 = home win, N = draw, 2 = away win (PRD §12.1). */
export function getMatchOutcome(homeScore: number, awayScore: number): PredictionChoice {
  return homeScore === awayScore ? "N" : homeScore > awayScore ? "1" : "2";
}

/** PRD §12.2. Forgotten predictions are counted as wrong because they stay in the denominator. */
export function calculateGamerResultPct(correct: number, eligible: number): number {
  if (!Number.isInteger(correct) || !Number.isInteger(eligible) || correct < 0 || eligible <= 0 || correct > eligible) throw new Error("Résultat de pronostics invalide.");
  return (correct / eligible) * 100;
}

/** Provisional population (PRD §24 item 11): every gamer with a frozen squad for the matchday. */
export function calculateMatchdayAveragePct(results: number[]): number {
  if (!results.length) throw new Error("Aucun joueur éligible pour calculer la moyenne.");
  return results.reduce((sum, value) => sum + value, 0) / results.length;
}

/** PRD §12.3–12.4. Whole-euro rounding keeps the 70/30 split cent-exact; the rounding policy is provisional. */
export function calculatePredictionEarnings(resultPct: number, averagePct: number): PredictionEarnings {
  const { cubic, linear, base, scale, min, max, negativePayoutDeducted } = getRulesSettings().predictions;
  const formula = { cubic, linear, base, scale };
  const limits = { min, max };
  const x = resultPct - averagePct;
  const rawG = (formula.cubic * x ** 3 + formula.linear * x + formula.base) * formula.scale;
  let earnings = Math.round(Math.min(limits.max, Math.max(limits.min, rawG)));
  if (resultPct === 0 && earnings > 0) earnings = 0;
  if (earnings < 0 && !negativePayoutDeducted) earnings = 0;
  earnings += 0; // normalise -0
  const { budget, lockedAccount } = distributeEarnings(earnings);
  return { resultPct, averagePct, x, rawG, earnings, budgetDelta: budget, lockedAccountDelta: lockedAccount };
}
