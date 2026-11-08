import { getRulesSettings } from "./settings";
import type { PlayerPosition } from "./types";
import { moneyRatio, moneySum } from "./money";

export type PlayerMatchInput = { started: boolean; minutesPlayed: number; goals: number; assists: number; ownGoals: number; yellowCards: number; redCards: number; penaltiesScored: number; penaltiesMissed: number; penaltiesSaved: number; saves: number; substitutionsOut?: number; goalsConceded?: number };

const pick = <T,>(pair: { starter: T; substitute: T }, started: boolean): T => (started ? pair.starter : pair.substitute);

/** Pure validation for entered official match facts. */
export function validatePlayerMatchInput(input: PlayerMatchInput): string | null {
  if (!Number.isInteger(input.minutesPlayed) || input.minutesPlayed < 0 || input.minutesPlayed > 130) return "Minutes de jeu invalides.";
  if (Object.values(input).some((value) => typeof value === "number" && value < 0)) return "Les statistiques ne peuvent pas être négatives.";
  if (!input.started && input.minutesPlayed === 0 && (input.goals || input.assists || input.saves)) return "Un joueur sans minute ne peut pas avoir de statistiques de jeu.";
  return null;
}

/** Barème (PRD §11.1–11.3), exprimé en euros et lu dans les Barèmes actifs. Les événements marqués * dans la source ne sont pas inférés. */
export function calculatePlayerMatchEffect(position: PlayerPosition, input: PlayerMatchInput): number {
  const invalid = validatePlayerMatchInput(input); if (invalid) throw new Error(invalid);
  const { primes } = getRulesSettings();
  if (input.minutesPlayed === 0) return primes.notPlayed;
  const conceded = input.goalsConceded ?? 0;
  const concededMalus = conceded >= 2 ? primes.concededSecond + Math.max(0, conceded - 2) * primes.concededExtra : 0;
  // The selection state, not the football line-up, picks the starter / substitute column (see settlement).
  const s = input.started;
  return pick(primes.base, s)[position] + input.goals * pick(primes.goal, s)[position] + input.assists * pick(primes.assist, s)[position]
    + input.penaltiesScored * pick(primes.penaltyScored, s) + input.saves * primes.save + (input.goalsConceded === 0 ? pick(primes.cleanSheet, s)[position] : 0)
    + input.redCards * pick(primes.red, s)[position] + input.yellowCards * pick(primes.yellow, s)[position] + input.ownGoals * pick(primes.ownGoal, s)
    + input.penaltiesMissed * pick(primes.missedPenalty, s) + (input.substitutionsOut ?? 0) * pick(primes.substituted, s) + concededMalus;
}
export function applyCaptainMultiplier(effect: number): number { return effect * getRulesSettings().captain.multiplier; }
export function distributeEarnings(amount: number): { budget: number; lockedAccount: number } {
  const budget = amount >= 0 ? moneyRatio(amount, getRulesSettings().budget.positiveShareToBudgetPct, 100) : amount;
  return { budget, lockedAccount: moneySum(amount, -budget) };
}

export type EarningLine = { key: string; label: string; amount: number };
const plural = (count: number, one: string, many: string) => `${count} ${count > 1 ? many : one}`;

/**
 * Itemised version of {@link calculatePlayerMatchEffect} for the player-profile "Dotations" breakdown. The amounts always
 * add up to the match effect (verified by tests); team result is passed in already converted to its barème amount.
 */
export function explainPlayerMatchEffect(position: PlayerPosition, input: PlayerMatchInput, teamResultEffect = 0): { total: number; lines: EarningLine[] } {
  const invalid = validatePlayerMatchInput(input); if (invalid) throw new Error(invalid);
  const { primes } = getRulesSettings();
  if (input.minutesPlayed === 0) return { total: primes.notPlayed, lines: [{ key: "not-played", label: "Non joué", amount: primes.notPlayed }] };
  const s = input.started;
  const lines: EarningLine[] = [];
  const add = (key: string, label: string, amount: number) => { if (amount !== 0) lines.push({ key, label, amount }); };
  if (teamResultEffect !== 0) add("team", teamResultEffect > 0 ? "Victoire" : "Défaite", teamResultEffect);
  add("clean-sheet", "Défense invaincue", input.goalsConceded === 0 ? pick(primes.cleanSheet, s)[position] : 0);
  add("role", s ? "Titulaire" : "Remplaçant", pick(primes.base, s)[position]);
  add("substituted", "Remplacé", (input.substitutionsOut ?? 0) * pick(primes.substituted, s));
  add("goals", plural(input.goals, "But", "Buts"), input.goals * pick(primes.goal, s)[position]);
  add("assists", plural(input.assists, "Passe décisive", "Passes décisives"), input.assists * pick(primes.assist, s)[position]);
  add("penalties", plural(input.penaltiesScored, "Pénalty marqué", "Pénaltys marqués"), input.penaltiesScored * pick(primes.penaltyScored, s));
  add("saves", plural(input.saves, "Arrêt", "Arrêts"), input.saves * primes.save);
  add("yellow", plural(input.yellowCards, "Carton jaune", "Cartons jaunes"), input.yellowCards * pick(primes.yellow, s)[position]);
  add("red", plural(input.redCards, "Carton rouge", "Cartons rouges"), input.redCards * pick(primes.red, s)[position]);
  add("own-goals", plural(input.ownGoals, "But contre son camp", "Buts contre son camp"), input.ownGoals * pick(primes.ownGoal, s));
  add("penalties-missed", plural(input.penaltiesMissed, "Pénalty raté", "Pénaltys ratés"), input.penaltiesMissed * pick(primes.missedPenalty, s));
  const conceded = input.goalsConceded ?? 0;
  add("conceded", `${conceded} buts encaissés`, conceded >= 2 ? primes.concededSecond + Math.max(0, conceded - 2) * primes.concededExtra : 0);
  return { total: lines.reduce((sum, line) => sum + line.amount, 0), lines };
}
