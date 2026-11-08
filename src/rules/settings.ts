import { z } from "zod";

/**
 * Editable rules settings ("Barèmes", PRD v1.3 §23). The defaults below are the PRD v3.2.0 reference values; every
 * figure the PRD marks provisional is stored in `public.rules_settings` and can be changed by an administrator.
 * Rule functions read the active settings through {@link getRulesSettings}; the server loads them before computing.
 */
export const positionKeys = ["GK", "DF", "MF", "FW"] as const;
export const honoursCategories = ["overall", "first_half", "primes", "predictions", "matchday_primes", "matchday_predictions"] as const;
export const honoursBandKeys = ["1", "2", "3", "10", "20", "30", "50", "100"] as const;
export const bonusIds = ["cholismo", "turpin", "clean-sheets", "sorti-du-frigo", "caviar-en-stock", "fergie-time"] as const;

const money = z.number().finite();
const perPosition = z.object({ GK: money, DF: money, MF: money, FW: money });
const pair = <T extends z.ZodTypeAny>(shape: T) => z.object({ starter: shape, substitute: shape });
const taxStep = z.object({ throughMatchday: z.number().int().min(1).max(40), rate: z.number().min(0).max(1) });
const weekday = z.number().int().min(0).max(6);
const time = z.string().regex(/^\d{2}:\d{2}$/);

export const rulesSettingsSchema = z.object({
  budget: z.object({
    coefficientInitial: z.number().min(0).max(10),
    coefficientMatchday: z.number().min(0).max(10),
    /** Share of positive earnings paid to the Budget; the rest goes to the Blocked Account (PRD §11.6). */
    positiveShareToBudgetPct: z.number().int().min(0).max(100),
  }),
  transfers: z.object({
    fixedMercadoCommission: z.number().min(0),
    tax: z.object({ mercado: z.array(taxStep).length(3), direct: z.array(taxStep).length(3) }),
    /** Demand effect of one purchase / sale on a player's value (PRD §23: ±20k, applied at 50 % by the Mercato). */
    impactBuy: z.number().min(0),
    impactSale: z.number().min(0),
    mercadoSharePct: z.number().min(0).max(100),
  }),
  captain: z.object({ multiplier: z.number().min(1).max(10) }),
  predictions: z.object({
    cubic: z.number(), linear: z.number(), base: z.number(), scale: z.number(),
    min: z.number(), max: z.number(), negativePayoutDeducted: z.boolean(),
  }),
  bonus: z.object({
    gainPct: z.number().min(0).max(100),
    list: z.array(z.object({ id: z.enum(bonusIds), enabled: z.boolean(), maxPerSeason: z.number().int().min(0).max(34) })).length(bonusIds.length),
  }),
  freeze: z.object({ hoursBeforeKickoff: z.number().min(0).max(24) }),
  primes: z.object({
    base: pair(perPosition), goal: pair(perPosition), assist: pair(perPosition), cleanSheet: pair(perPosition),
    yellow: pair(perPosition), red: pair(perPosition),
    penaltyScored: pair(money), ownGoal: pair(money), substituted: pair(money), missedPenalty: pair(money), save: money,
    notPlayed: money, concededSecond: money, concededExtra: money,
  }),
  teamResult: z.object({ home_win: money, away_win: money, home_draw: money, away_draw: money, home_loss: money, away_loss: money }),
  honours: z.record(z.enum(honoursCategories), z.record(z.enum(honoursBandKeys), z.number().int().min(0))),
  schedule: z.object({
    mercatoOpen: z.object({ day: weekday, time }),
    mercatoClose: z.object({ day: weekday, time }),
    thaw: z.object({ day: weekday, time }),
  }),
});
export type RulesSettings = z.infer<typeof rulesSettingsSchema>;

const flat = (value: number) => ({ GK: value, DF: value, MF: value, FW: value });
const honoursRow = (points: Partial<Record<(typeof honoursBandKeys)[number], number>>) =>
  Object.fromEntries(honoursBandKeys.map((band) => [band, points[band] ?? 0])) as Record<(typeof honoursBandKeys)[number], number>;

/** PRD v3.2.0 reference values (§5.1, §8.4, §9, §11, §12.4, §16.1, §23). */
export const defaultRulesSettings: RulesSettings = {
  budget: { coefficientInitial: 0.8, coefficientMatchday: 0.02, positiveShareToBudgetPct: 70 },
  transfers: {
    fixedMercadoCommission: 100_000,
    tax: {
      mercado: [{ throughMatchday: 17, rate: 0.08 }, { throughMatchday: 26, rate: 0.07 }, { throughMatchday: 34, rate: 0.06 }],
      direct: [{ throughMatchday: 17, rate: 0.1 }, { throughMatchday: 26, rate: 0.09 }, { throughMatchday: 34, rate: 0.08 }],
    },
    impactBuy: 20_000, impactSale: 20_000, mercadoSharePct: 50,
  },
  captain: { multiplier: 2 },
  predictions: { cubic: 0.008, linear: 8, base: 400, scale: 1200, min: -2_000_000, max: 2_000_000, negativePayoutDeducted: true },
  bonus: { gainPct: 10, list: [
    { id: "cholismo", enabled: true, maxPerSeason: 4 }, { id: "turpin", enabled: true, maxPerSeason: 4 }, { id: "clean-sheets", enabled: true, maxPerSeason: 4 },
    { id: "sorti-du-frigo", enabled: true, maxPerSeason: 4 }, { id: "caviar-en-stock", enabled: true, maxPerSeason: 4 }, { id: "fergie-time", enabled: true, maxPerSeason: 4 },
  ] },
  freeze: { hoursBeforeKickoff: 2 },
  primes: {
    base: { starter: flat(100_000), substitute: flat(20_000) },
    goal: { starter: { GK: 210_000, DF: 190_000, MF: 170_000, FW: 150_000 }, substitute: { GK: 230_000, DF: 210_000, MF: 190_000, FW: 170_000 } },
    assist: { starter: { GK: 180_000, DF: 160_000, MF: 140_000, FW: 120_000 }, substitute: { GK: 200_000, DF: 180_000, MF: 160_000, FW: 140_000 } },
    cleanSheet: { starter: { GK: 50_000, DF: 100_000, MF: 70_000, FW: 30_000 }, substitute: { GK: 30_000, DF: 80_000, MF: 50_000, FW: 10_000 } },
    yellow: { starter: { GK: -60_000, DF: -50_000, MF: -60_000, FW: -70_000 }, substitute: { GK: -80_000, DF: -70_000, MF: -80_000, FW: -90_000 } },
    red: { starter: flat(-150_000), substitute: flat(-170_000) },
    penaltyScored: { starter: 100_000, substitute: 120_000 },
    ownGoal: { starter: -100_000, substitute: -120_000 },
    substituted: { starter: -20_000, substitute: -20_000 },
    missedPenalty: { starter: -100_000, substitute: -100_000 },
    save: 15_000, notPlayed: -200_000, concededSecond: -20_000, concededExtra: -10_000,
  },
  teamResult: { home_win: 100_000, away_win: 150_000, home_draw: 0, away_draw: 50_000, home_loss: -150_000, away_loss: -50_000 },
  honours: {
    overall: honoursRow({ 1: 300, 2: 250, 3: 200, 10: 150, 20: 100, 30: 75, 50: 50, 100: 25 }),
    first_half: honoursRow({ 1: 15, 2: 10, 3: 5 }),
    primes: honoursRow({ 1: 70, 2: 60, 3: 50, 10: 30, 20: 25, 30: 20, 50: 10, 100: 6 }),
    predictions: honoursRow({ 1: 35, 2: 30, 3: 25, 10: 15, 20: 10, 30: 8, 50: 6, 100: 4 }),
    matchday_primes: honoursRow({ 1: 15, 2: 12, 3: 10, 10: 5, 20: 4, 30: 3, 50: 2, 100: 1 }),
    matchday_predictions: honoursRow({ 1: 5 }),
  },
  schedule: { mercatoOpen: { day: 1, time: "20:00" }, mercatoClose: { day: 2, time: "20:00" }, thaw: { day: 2, time: "20:30" } },
};

let active: RulesSettings = defaultRulesSettings;
export function getRulesSettings(): RulesSettings { return active; }
export function setRulesSettings(next: RulesSettings) { active = next; }

/** Deep-merges stored (possibly older) settings over the defaults so new keys always have a value. */
export function mergeWithDefaults(stored: unknown): RulesSettings {
  const merge = (base: unknown, patch: unknown): unknown => {
    if (Array.isArray(base)) return Array.isArray(patch) && patch.length === base.length ? patch.map((item, i) => merge(base[i], item)) : base;
    if (base && typeof base === "object") {
      const source = (patch && typeof patch === "object" ? patch : {}) as Record<string, unknown>;
      return Object.fromEntries(Object.entries(base).map(([key, value]) => [key, merge(value, source[key])]));
    }
    return typeof patch === typeof base ? patch : base;
  };
  const parsed = rulesSettingsSchema.safeParse(merge(defaultRulesSettings, stored));
  return parsed.success ? parsed.data : defaultRulesSettings;
}
