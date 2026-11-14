import { notFound } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import type { ActivityEvent, MatchRow, PlayerProfile } from "@/data/repositories/player-profile-repository";
import { PlayerActivityView, PlayerProfileView, type ActivityFilter } from "@/features/players/player-profile";
import { sidebarFixture } from "../_fixtures";

const row = (day: number, kickoff: string, home: string, away: string, hs: number, as: number, result: MatchRow["result"], extra: Partial<MatchRow>): MatchRow => ({ homeId: "home", awayId: "away", matchHref: "/ligue-1",
  day, kickoff, home, away, homeScore: hs, awayScore: as, result, minutes: 90, started: true, substitutedOut: false, played: true, goals: 0, assists: 0, cleanSheet: false, yellow: 0, red: 0, ownGoals: 0, total: 0, lines: [], ...extra,
});
const rows: MatchRow[] = [
  row(5, "2026-05-17T18:00:00Z", "Strasbourg", "Lens", 0, 3, "win", { started: false, minutes: 60, total: 20_000, lines: [{ key: "x", label: "Victoire", amount: 20_000 }] }),
  row(4, "2026-05-10T18:00:00Z", "Lens", "Paris SG", 1, 2, "loss", { played: false, minutes: 0, total: -200_000, lines: [{ key: "np", label: "Non joué", amount: -200_000 }] }),
  row(3, "2026-05-03T18:00:00Z", "Nantes", "Lens", 0, 3, "win", {
    substitutedOut: true, minutes: 86, goals: 1, assists: 1, yellow: 1, total: 470_000,
    lines: [{ key: "a", label: "Victoire à l’extérieur", amount: 150_000 }, { key: "b", label: "Défense invaincue", amount: 50_000 }, { key: "c", label: "Titulaire", amount: 100_000 }, { key: "d", label: "Remplacé", amount: -20_000 }, { key: "e", label: "1 But", amount: 150_000 }, { key: "f", label: "1 Passe décisive", amount: 110_000 }, { key: "g", label: "1 Carton jaune", amount: -70_000 }],
  }),
  row(2, "2026-04-26T18:00:00Z", "Lens", "Le Havre", 2, 1, "win", { substitutedOut: true, minutes: 64, cleanSheet: true, yellow: 1, total: 270_000, lines: [{ key: "x", label: "Victoire", amount: 270_000 }] }),
  row(1, "2026-04-19T18:00:00Z", "Brest", "Lens", 2, 2, "draw", { goals: 1, total: 220_000, lines: [{ key: "x", label: "But", amount: 220_000 }] }),
];
const profile = (owned: boolean): PlayerProfile => ({
  id: "kvara", firstName: "Khvicha", lastName: "Kvaratskhelia", position: "FW", club: { id: "psg", name: "Paris Saint-Germain", short: "Paris SG", code: "PSG" },
  value: 18_620_000, initialValue: 12_610_000, changePct: 24.78, form: ["V", "N", "D", "V", "V"], holders: 34,
  owned: owned ? { acquiredValue: 14_350_000, acquiredAt: "2026-09-14T21:12:00Z" } : null, primes: 4_270_000, mercatoSincePurchase: 520_000, mercatoTotal: owned ? 1_300_000 : 520_000, mercatoLast: 1_300_000,
  perf: { played: 31, started: 26, notPlayed: 3, goals: 12, penalties: 2, assists: 8, yellow: 12, red: 1 }, market: { buys: 92, sells: 62, todayBuys: 2, todaySells: 16 },
  chart: [{ day: 1, amount: 600_000 }, { day: 2, amount: -50_000 }, { day: 3, amount: -200_000 }, { day: 4, amount: 80_000 }, { day: 5, amount: 310_000 }, { day: 6, amount: 160_000 }, { day: 7, amount: 710_000 }, { day: 8, amount: -60_000 }],
  rows,
});
const events: ActivityEvent[] = [
  { id: "1", at: "2026-09-08T18:30:00Z", kind: "mercato", label: "Mercato", impact: 340_000, value: 3_490_000 },
  { id: "2", at: "2026-09-05T18:45:00Z", kind: "primes", label: "Primes J14", impact: -200_000, value: 3_150_000 },
  { id: "3", at: "2026-09-05T17:14:00Z", kind: "achat", label: "Achat", impact: 20_000, value: 3_010_000 },
  { id: "4", at: "2026-09-05T17:14:30Z", kind: "achat", label: "Achat", impact: 20_000, value: 2_990_000 },
  { id: "5", at: "2026-09-05T17:14:40Z", kind: "achat", label: "Achat", impact: 20_000, value: 2_970_000 },
  { id: "6", at: "2026-09-05T06:02:00Z", kind: "vente", label: "Vente", impact: -20_000, value: 2_950_000 },
  { id: "7", at: "2026-09-04T21:57:00Z", kind: "achat", label: "Achat", impact: 20_000, value: 2_970_000 },
  { id: "8", at: "2026-09-04T21:45:00Z", kind: "achat", label: "Achat", impact: 20_000, value: 2_950_000 },
  { id: "9", at: "2026-09-04T06:02:00Z", kind: "vente", label: "Vente", impact: -20_000, value: 2_930_000 },
  { id: "10", at: "2026-09-03T15:23:00Z", kind: "achat", label: "Achat", impact: 20_000, value: 2_950_000 },
  { id: "11", at: "2026-09-03T12:28:00Z", kind: "achat", label: "Achat", impact: 20_000, value: 2_930_000 },
];

/** Development-only fixtures of the three Figma "Player Form" frames: ?variant=owned|other|activity */
export default async function Preview({ searchParams }: { searchParams: Promise<{ variant?: string; filter?: string; open?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { variant, filter, open } = await searchParams;
  return (
    <AppShell {...sidebarFixture}>
      <main className="app-page" style={{ minHeight: 0 }}>
        {variant === "activity"
          ? <PlayerActivityView player={{ id: "kvara", firstName: "Khvicha", lastName: "Kvaratskhelia", clubId: "psg", clubShort: "Paris SG", events }} filter={(filter as ActivityFilter) ?? "tout"} basePath="/dev-preview/player" query={{ variant: "activity" }} />
          : <PlayerProfileView profile={profile(variant !== "other")} basePath="/dev-preview/player" defaultOpen={open ? Number(open) : undefined} />}
      </main>
    </AppShell>
  );
}
