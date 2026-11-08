/**
 * MARKETFOOT's public business-rules interface.
 *
 * Application code must never duplicate game rules in UI, actions, services, or
 * repositories; it must consume this module instead. Implementations must follow
 * the functional PRD, and unresolved client requirements must never be guessed.
 */
export const marketfootRules = {} as const;

export { validateInitialSquad, validateReplacementClubLimit } from "./squad";
export { calculateInitialBudget } from "./budget";
export { getTeamFreezeTime, isTeamFrozen } from "./freeze";
export { calculateMercadoDemandDelta, calculateMercadoOrderCost, getTransferTaxRate, validateDirectTransfer, validateMercadoOrder } from "./transfers";
export { validateLineup } from "./lineup";
export { applyCaptainMultiplier, calculatePlayerMatchEffect, distributeEarnings, explainPlayerMatchEffect, validatePlayerMatchInput } from "./earnings";
export type { EarningLine, PlayerMatchInput } from "./earnings";
export { teamResultEffects, teamResultOf } from "./settlement";
export { calculateSettlementEffect } from "./settlement";
export type { OfficialMatchContext, PlayerSettlementResult, SettlementSnapshot } from "./settlement";
export { calculateGamerResultPct, calculateMatchdayAveragePct, calculatePredictionEarnings, getMatchOutcome } from "./predictions";
export type { PredictionChoice, PredictionEarnings } from "./predictions";
export { marketfootRulesConfig } from "./config";

export type { PlayerPosition, RuleResult } from "./types";
export { bandPoints, honoursBand, honoursBands, honoursPoints, trophySections, trophySlotCount } from "./honours";
export type { HonoursBand, HonoursCategory } from "./honours";
export { defaultRulesSettings, getRulesSettings, setRulesSettings, rulesSettingsSchema, mergeWithDefaults } from "./settings";
export type { RulesSettings } from "./settings";
export { calculateBonusAmount, foldBonusIntoEffects, isBonusSuccessful } from "./bonus";
export type { BonusEffectRow, BonusPlayer } from "./bonus";
