import { getRulesSettings } from "./settings";

/** Honours points and trophy bands — mirrors `public.honours_points` (Game Rules v2 §15). Keep both in sync. */
export type HonoursCategory = "overall" | "first_half" | "primes" | "predictions" | "matchday_primes" | "matchday_predictions";
export type HonoursBand = 1 | 2 | 3 | 10 | 20 | 30 | 50 | 100;
export const honoursBands: HonoursBand[] = [1, 2, 3, 10, 20, 30, 50, 100];

const table = (category: HonoursCategory): Record<string, number> => (getRulesSettings().honours[category] ?? {}) as Record<string, number>;

/** Smallest band containing a rank (1, 2, 3, then 4–10, 11–20, 21–30, 31–50, 51–100), or null beyond 100. */
export function honoursBand(rank: number): HonoursBand | null {
  if (!Number.isInteger(rank) || rank < 1) return null;
  return honoursBands.find((band) => rank <= band) ?? null;
}
export function honoursPoints(category: HonoursCategory, rank: number): number {
  const band = honoursBand(rank);
  return band ? table(category)[String(band)] ?? 0 : 0;
}
export function bandPoints(category: HonoursCategory, band: HonoursBand): number { return table(category)[String(band)] ?? 0; }

/** Trophy sections as drawn on the Palmarès screen, in order. `key` is the icon family under /images/trophies. */
export const trophySections: { title: string; rows: { key: string; category: HonoursCategory; bands: HonoursBand[]; label?: string }[] }[] = [
  { title: "Classement général", rows: [{ key: "overall", category: "overall", bands: honoursBands }, { key: "first-half", category: "first_half", bands: [1, 2, 3], label: "phase aller" }] },
  { title: "Classement primes", rows: [{ key: "primes", category: "primes", bands: honoursBands }] },
  { title: "Classement pronostics", rows: [{ key: "predictions", category: "predictions", bands: honoursBands }] },
  { title: "Badge journée", rows: [{ key: "matchday", category: "matchday_primes", bands: honoursBands }, { key: "matchday-pred", category: "matchday_predictions", bands: [1] }] },
];
export const trophySlotCount = trophySections.reduce((sum, section) => sum + section.rows.reduce((inner, row) => inner + row.bands.length, 0), 0);
