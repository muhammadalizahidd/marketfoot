import { notFound } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import type { PlayerTableRow } from "@/data/repositories/players-repository";
import { PlayersView, type PlayersParams } from "@/features/players/players-view";
import { sidebarFixture } from "../_fixtures";

const row = (i: number): PlayerTableRow => ({
  id: `p${i}`, name: "K. Kvaratskhelia", clubId: "psg", clubName: "Paris Saint-Germain", position: "FW",
  value: 14_240_000, initialValue: 10_320_000, earnings: 3_130_000, lastEarning: 250_000, holders: 112, lastMercato: 140_000, buys: 112, sells: 78,
  matches: 12, starters: 8, goals: 4, assists: 4, saves: 4, ownGoals: 7, penalties: 0, yellow: 24, red: 32,
});
const clubs = ["Angers", "Auxerre", "Brest", "Le Havre", "Le Mans", "Lens", "Lille", "Lorient", "Lyon", "Marseille", "Monaco", "Nice", "Paris SG", "Paris FC", "Rennes", "Strasbourg", "Toulouse", "Troyes"].map((name) => ({ id: name, name }));

/** Development-only fixtures of Figma "Player Table 1-4": ?view=general|performance|speculation&period=today&open=club */
export default async function Preview({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const q = await searchParams;
  const view = (["general", "performance", "speculation"].includes(q.view ?? "") ? q.view : "speculation") as PlayersParams["view"];
  const params: PlayersParams = {
    view, period: (q.period as PlayersParams["period"]) ?? "all", clubs: q.club ? q.club.split(",") : [], position: q.position, sort: q.sort, dir: q.dir === "asc" ? "asc" : "desc",
    page: Number(q.page) || 1, size: Number(q.size) || 10, open: q.open as PlayersParams["open"], min: q.min ? Number(q.min) : undefined, max: q.max ? Number(q.max) : undefined,
  };
  const count = view === "speculation" ? (params.period === "today" ? 4 : 7) : view === "performance" ? 12 : 6;
  return (
    <AppShell {...sidebarFixture}>
      <main className="app-page" style={{ minHeight: 0 }}>
        <PlayersView params={params} rows={Array.from({ length: count }, (_, i) => row(i))} total={200} clubs={clubs} seasonName="Championnat 2026/2027" basePath="/dev-preview/players" />
      </main>
    </AppShell>
  );
}
