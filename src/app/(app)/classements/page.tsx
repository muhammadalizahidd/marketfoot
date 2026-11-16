import Link from "next/link";
import type { Metadata } from "next";

import { FriendsToggle, NavSelect } from "@/components/ranking/ranking-controls";
import { RankingTable } from "@/components/ranking/ranking-table";
import { getLeagueData } from "@/data/repositories/league-repository";
import { getRankingTable, rankingMetrics, rankingPeriods, type RankingMetric, type RankingPeriod } from "@/data/repositories/ranking-table-repository";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Classements" };

type Query = { tab?: string; period?: string; season?: string; day?: string; q?: string; page?: string; size?: string; sort?: string; dir?: string; friends?: string };

const tabs: [RankingMetric, string][] = [["general", "Général"], ["primes", "Primes"], ["predictions", "Pronostics"], ["speculation", "Spéculation"], ["honours", "Palmarès"], ["bench", "Banc de touche"]];
const periods: [RankingPeriod, string][] = [["all", "Général"], ["first", "Phase aller"], ["second", "Phase retour"], ["day", "Journée"]];
const pageSizes = [10, 20, 50];

const searchIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;

export default async function RankingsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const q = await searchParams;
  const metric = rankingMetrics.find((item) => item === q.tab) ?? "general";
  const period: RankingPeriod = metric === "honours" ? "all" : rankingPeriods.find((item) => item === q.period) ?? "all";
  const pageSize = pageSizes.includes(Number(q.size)) ? Number(q.size) : 10;
  const page = Math.max(1, Math.floor(Number(q.page)) || 1);
  const dir = q.dir === "desc" ? "desc" : "asc";
  const sort = q.sort ?? "rank";
  const friendsOnly = q.friends === "1";
  const text = (q.q ?? "").slice(0, 80);

  const league = await getLeagueData(q.season).catch(() => null);
  const season = league?.season;
  const dayNumbers = (league?.days ?? []).map((day) => day.number);
  const lastDay = league?.day?.number ?? dayNumbers.at(-1) ?? 34;
  const dayNumber = dayNumbers.includes(Number(q.day)) ? Number(q.day) : lastDay;

  const db = await createSupabaseServerClient();
  const { data: { user } } = await db.auth.getUser();
  const result = season && user
    ? await getRankingTable({ seasonId: season.id, metric, period, day: dayNumber, search: text, page, pageSize, sort, dir, friendsOnly })
    : { rows: [], total: 0, error: false };

  /** Current URL with some parameters replaced (null removes one). */
  const href = (changes: Record<string, string | null>) => {
    const current: Record<string, string> = {
      tab: metric, ...(period !== "all" ? { period } : {}), ...(season ? { season: season.id } : {}), ...(period === "day" ? { day: String(dayNumber) } : {}),
      ...(text ? { q: text } : {}), ...(pageSize !== 10 ? { size: String(pageSize) } : {}), ...(sort !== "rank" || dir !== "asc" ? { sort, dir } : {}), ...(friendsOnly ? { friends: "1" } : {}),
    };
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...current, ...changes })) if (value) params.set(key, value);
    return `/classements?${params}`;
  };
  const pages = Math.max(1, Math.ceil(result.total / pageSize));
  const from = result.total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(page * pageSize, result.total);
  const dayIndex = dayNumbers.indexOf(dayNumber);
  const stepPeriod = period === "all" ? "day" : period;

  return (
    <main className="rk-page">
      <div className="rk-top">
        <nav className="rk-tabs" aria-label="Classements">
          {tabs.map(([id, label]) => <Link key={id} href={href({ tab: id, page: null, sort: null, dir: null })} className={metric === id ? "is-active" : undefined} aria-current={metric === id ? "page" : undefined}>{label}</Link>)}
        </nav>
        <form className="rk-search" action="/classements" role="search">
          {searchIcon}
          <input name="q" defaultValue={text} placeholder="Rechercher un pseudo" aria-label="Rechercher un pseudo" />
          <input type="hidden" name="tab" value={metric} />
          {period !== "all" && <input type="hidden" name="period" value={period} />}
          {season && <input type="hidden" name="season" value={season.id} />}
          {period === "day" && <input type="hidden" name="day" value={dayNumber} />}
          {friendsOnly && <input type="hidden" name="friends" value="1" />}
        </form>
      </div>

      <div className="rk-filters">
        <FriendsToggle checked={friendsOnly} />
        <div className="rk-selectors">
          {league && league.seasons.length > 0 && <NavSelect param="season" className="rk-season" label="Championnat" value={season?.id ?? ""} options={league.seasons.map((item) => ({ value: item.id, label: `Championnat ${item.name}` }))} />}
          {metric !== "honours" && dayIndex >= 0 && (
            <span className="rk-stepper" role="group" aria-label="Journée">
              {dayIndex > 0 ? <Link href={href({ day: String(dayNumbers[dayIndex - 1]), page: null, period: stepPeriod })} aria-label="Journée précédente">‹</Link> : <span aria-hidden="true">‹</span>}
              <b>J{dayNumber}</b>
              {dayIndex < dayNumbers.length - 1 ? <Link href={href({ day: String(dayNumbers[dayIndex + 1]), page: null, period: stepPeriod })} aria-label="Journée suivante">›</Link> : <span aria-hidden="true">›</span>}
            </span>
          )}
        </div>
      </div>

      {metric !== "honours" && (
        <nav className="rk-periods" aria-label="Période">
          {periods.map(([id, label]) => <Link key={id} href={href({ period: id === "all" ? null : id, day: id === "day" ? String(dayNumber) : null, page: null })} className={period === id ? "is-active" : undefined}>{label}{id === "day" && period === "day" ? <em>J{dayNumber}</em> : null}</Link>)}
        </nav>
      )}

      {result.error ? (
        <section className="rk-empty" role="alert"><h1>Classement indisponible</h1><p>Réessayez dans quelques instants.</p></section>
      ) : result.rows.length ? (
        <>
          <RankingTable metric={metric} rows={result.rows} meId={user?.id ?? ""} sort={sort} dir={dir} sortHref={(key, next) => href({ sort: key, dir: next, page: null })} />
          <footer className="rk-foot">
            <div className="rk-size">
              <NavSelect param="size" className="rk-pick" label="Résultats par page" value={String(pageSize)} options={pageSizes.map((size) => ({ value: String(size), label: String(size) }))} />
              <b>résultats par page</b><span>{from}-{to} de {result.total} résultats</span>
            </div>
            <div className="rk-pager">
              <NavSelect param="page" className="rk-pick" label="Page" value={String(Math.min(page, pages))} options={Array.from({ length: pages }, (_, index) => ({ value: String(index + 1), label: String(index + 1) }))} />
              <span>sur {pages} page{pages > 1 ? "s" : ""}</span>
              {page > 1 ? <Link href={href({ page: String(page - 1) })} aria-label="Page précédente">‹</Link> : <span aria-hidden="true">‹</span>}
              {page < pages ? <Link href={href({ page: String(page + 1) })} aria-label="Page suivante">›</Link> : <span aria-hidden="true">›</span>}
            </div>
          </footer>
        </>
      ) : (
        <section className="rk-empty">
          <h1>Aucun classement</h1>
          <p>{friendsOnly ? "Aucun de vos amis ne figure dans ce classement." : "Aucun résultat validé ne correspond à cette période ou à votre recherche."}</p>
          <Link href={href({ q: null, friends: null, period: null, day: null, page: null, sort: null, dir: null })}>Réinitialiser les filtres</Link>
        </section>
      )}
    </main>
  );
}
