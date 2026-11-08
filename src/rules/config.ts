/**
 * Configuration belongs here only after its product requirement is confirmed.
 * Do not add provisional figures from the PRD without an explicit status and source.
 */
/** Source: MARKETFOOT_SOURCE_RULES_AND_FORMULAS_v3.2.0.md §39. */
export const marketfootRulesConfig = {
  squad: { size: 19, starters: 11, substitutes: 8, maxPlayersPerClub: 4, positions: { GK: 3, DF: 6, MF: 5, FW: 5 } },
  initialBudget: { coefficientInitial: 0.8, coefficientMatchday: 0.02, status: "provisional" as const },
  transfers: { quotaPerMatchday: 4, fixedMercadoCommission: 100_000 },
  /** Source §9.1. Other tax tables conflict; this is the selected v3.2.0 schedule and remains provisional. */
  transferTax: { status: "provisional" as const, mercado: [{ throughMatchday: 17, rate: 0.08 }, { throughMatchday: 26, rate: 0.07 }, { throughMatchday: 34, rate: 0.06 }], direct: [{ throughMatchday: 17, rate: 0.1 }, { throughMatchday: 26, rate: 0.09 }, { throughMatchday: 34, rate: 0.08 }] },
  captain: { maxUsesPerChampionship: 6, multiplier: 2 },
  /** Source §2830 / PRD §12 and §24 items 911. Formula marked "WILL CHANGE" by the source; policies below are provisional pending client answers. */
  predictions: { status: "provisional" as const, formula: { cubic: 0.008, linear: 8, base: 400, scale: 1200 }, limits: { min: -2_000_000, max: 2_000_000 }, negativePayoutDeducted: true, averagePopulation: "active_squads" as const },
  freeze: { hoursBeforeKickoff: 2 },
} as const;
