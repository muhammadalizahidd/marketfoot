import { notFound } from "next/navigation";

import { getCurrentUserId } from "@/lib/auth/session";
import { getPlayerActivity, getPlayerProfile } from "@/data/repositories/player-profile-repository";
import { getClubOptions, getPlayersTable, type PlayersView as View, type SpeculationPeriod } from "@/data/repositories/players-repository";
import { PlayerActivityView, PlayerProfileView, type ActivityFilter } from "@/features/players/player-profile";
import { PlayersView, type PlayersParams } from "@/features/players/players-view";

type Search = { detail?: string; filter?: string; view?: string; period?: string; q?: string; position?: string; club?: string; min?: string; max?: string; sort?: string; dir?: string; page?: string; size?: string; open?: string; player?: string };

const pick = <T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T => allowed.find((item) => item === value) ?? fallback;
const money = (value?: string) => { const number = Number(value); return value && Number.isFinite(number) && number >= 0 ? number : undefined; };

export default async function PlayersPage({ searchParams }: { searchParams: Promise<Search> }) {
  const query = await searchParams;
  if (query.player) {
    // Full player profile (canonical state of /joueurs): owned/unowned presentation is decided from the signed-in squad.
    const filters = Object.fromEntries(Object.entries(query).filter(([key, value]) => value && !["player", "detail", "filter"].includes(key))) as Record<string, string>;
    if (query.detail === "activity") {
      const activity = await getPlayerActivity(query.player);
      if (!activity) notFound();
      const filter = (["achats", "ventes", "primes", "mercato"] as const).find((item) => item === query.filter) ?? "tout";
      return <main className="app-page"><PlayerActivityView player={{ id: activity.id, firstName: activity.firstName, lastName: activity.lastName, clubId: activity.clubId, clubShort: activity.clubShort, events: activity.events }} filter={filter as ActivityFilter} query={filters} /></main>;
    }
    const profile = await getPlayerProfile(query.player, (await getCurrentUserId()) ?? undefined);
    if (!profile) notFound();
    return <main className="app-page"><PlayerProfileView profile={profile} query={filters} /></main>;
  }
  const view = pick<View>(query.view, ["general", "performance", "speculation"], "general");
  const params: PlayersParams = {
    view,
    period: pick<SpeculationPeriod>(query.period, ["all", "mercato", "today"], "all"),
    q: query.q || undefined,
    position: ["GK", "DF", "MF", "FW"].includes(query.position ?? "") ? query.position : undefined,
    clubs: (query.club ?? "").split(",").filter(Boolean).slice(0, 20),
    min: money(query.min), max: money(query.max),
    sort: query.sort || undefined,
    dir: query.dir === "asc" ? "asc" : "desc",
    page: Math.max(1, Math.floor(Number(query.page)) || 1),
    size: [10, 20, 50].includes(Number(query.size)) ? Number(query.size) : 10,
    open: (["prix", "club", "poste"] as const).find((item) => item === query.open),
    player: query.player,
  };
  // Price inputs are typed in M€ in the form; links keep the value in euros.
  if (query.min !== undefined && Number(query.min) > 0 && Number(query.min) < 1000) params.min = Number(query.min) * 1_000_000;
  if (query.max !== undefined && Number(query.max) > 0 && Number(query.max) < 1000) params.max = Number(query.max) * 1_000_000;
  const [table, options] = await Promise.all([
    getPlayersTable(params).catch(() => ({ rows: [], total: 0, page: 1, size: params.size })),
    getClubOptions(),
  ]);
  const season = options.seasons.find((item) => item.is_current) ?? options.seasons[0];
  return <main className="app-page">
    <PlayersView params={params} rows={table.rows} total={table.total} clubs={options.clubs} seasonName={season ? `Championnat ${season.name}` : "Championnat"} />
  </main>;
}
