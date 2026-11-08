import { marketfootRulesConfig } from "./config";
import { getRulesSettings } from "./settings";

/**
 * Source §5: AVG × 19 × COEFF_INI + (NB_MATCHDAY × COEFF_STEP).
 * The source labels this formula "WILL CHANGE"; callers must expose it as provisional.
 */
export function calculateInitialBudget(averagePlayerValue: number, matchdaysPlayed: number): number {
  if (!Number.isFinite(averagePlayerValue) || averagePlayerValue < 0) throw new Error("La valeur moyenne doit être positive.");
  if (!Number.isInteger(matchdaysPlayed) || matchdaysPlayed < 0) throw new Error("Le nombre de journées doit être un entier positif.");
  const { coefficientInitial, coefficientMatchday } = getRulesSettings().budget;
  return averagePlayerValue * marketfootRulesConfig.squad.size * coefficientInitial + matchdaysPlayed * coefficientMatchday;
}
