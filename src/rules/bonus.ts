import { getRulesSettings, type bonusIds } from "./settings";

type BonusId = (typeof bonusIds)[number];
import { distributeEarnings } from "./earnings";
import { moneyRatio } from "./money";

/** One of the gamer's line-up players for the settled matchday, with the official facts of his match. */
export type BonusPlayer = {
  position: "GK" | "DF" | "MF" | "FW";
  isStarter: boolean;
  played: boolean;
  /** Real-life starter (not on the bench at kick-off). */
  startedMatch: boolean;
  goals: number; assists: number; penaltiesScored: number; stoppageTimeGoals: number;
  teamGoalsFor: number; teamGoalsAgainst: number;
  postponed: boolean;
};

/**
 * Does the chosen bonus come true? PRD §6.4: only the gamer's starters count; postponed matches never trigger a bonus.
 * - cholismo: at least 2 starters whose team won 1-0
 * - turpin: a starter scores a penalty
 * - clean-sheets: the starting goalkeeper wins without conceding
 * - sorti-du-frigo: a starter comes off the bench and scores
 * - caviar-en-stock: a starter gives two assists in the same match
 * - fergie-time: a starter scores in stoppage time
 */
export function isBonusSuccessful(bonus: BonusId, lineup: BonusPlayer[]): boolean {
  const starters = lineup.filter((player) => player.isStarter && !player.postponed);
  switch (bonus) {
    case "cholismo": return starters.filter((p) => p.played && p.teamGoalsFor - p.teamGoalsAgainst === 1 && p.teamGoalsAgainst === 0).length >= 2;
    case "turpin": return starters.some((p) => p.penaltiesScored >= 1);
    case "clean-sheets": return starters.some((p) => p.position === "GK" && p.played && p.teamGoalsAgainst === 0 && p.teamGoalsFor > 0);
    case "sorti-du-frigo": return starters.some((p) => p.played && !p.startedMatch && p.goals >= 1);
    case "caviar-en-stock": return starters.some((p) => p.assists >= 2);
    case "fergie-time": return starters.some((p) => p.stoppageTimeGoals >= 1);
    default: return false;
  }
}

/** PRD §6.4 / §11.8: a successful bonus adds the Barèmes share (default 10 %) of the starters' total primes; never negative. */
export function calculateBonusAmount(startersTotalPrimes: number): number {
  const pct = getRulesSettings().bonus.gainPct;
  if (startersTotalPrimes <= 0 || pct <= 0) return 0;
  try { return moneyRatio(startersTotalPrimes, Math.round(pct * 100), 10_000); } catch { return Math.floor((startersTotalPrimes * pct) / 100); }
}

export type BonusEffectRow = { gamerId: string; gamerEffect: number; budgetDelta: number; lockedAccountDelta: number; bonusAdjustment?: number; calculation: Record<string, unknown> };

/**
 * Folds a successful bonus into the gamer's largest starter effect so every settlement row stays balanced
 * (budget + locked = gamer effect) and rollbacks reverse it with the rest. Returns the amount credited.
 */
export function foldBonusIntoEffects<T extends BonusEffectRow>(effects: T[], gamerId: string, bonusId: string, succeeded: boolean): number {
  const starters = effects.filter((effect) => effect.gamerId === gamerId && effect.calculation.isStarter === true);
  const amount = succeeded ? calculateBonusAmount(starters.reduce((sum, effect) => sum + effect.gamerEffect, 0)) : 0;
  if (amount <= 0 || !starters.length) return 0;
  const target = [...starters].sort((a, b) => Math.abs(b.gamerEffect) - Math.abs(a.gamerEffect))[0];
  const split = distributeEarnings(amount);
  target.gamerEffect += amount; target.budgetDelta += split.budget; target.lockedAccountDelta += split.lockedAccount;
  target.bonusAdjustment = (target.bonusAdjustment ?? 0) + amount;
  target.calculation = { ...target.calculation, bonus: bonusId, bonusAmount: amount };
  return amount;
}
