import Link from "next/link";

import { getJerseyTrimImage } from "@/lib/jersey-map";
import type { ActivityEvent, PlayerProfile } from "@/data/repositories/player-profile-repository";
import { PrimeHistory } from "./prime-history";

const M = (value: number) => `${(value / 1_000_000).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} M€`;
const M1 = (value: number) => `${(value / 1_000_000).toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 1 })} M€`;
const amount = (value: number) => (Math.abs(value) >= 1_000_000 ? M1(Math.abs(value)) : `${Math.round(Math.abs(value) / 1000).toLocaleString("fr-FR")} k€`);
/** "+ 4,27 M€" as drawn in the summary cards. */
const spaced = (value: number, decimals = 2) => `${value > 0 ? "+ " : value < 0 ? "- " : ""}${Math.abs(value) >= 1_000_000 ? (decimals === 2 ? M(Math.abs(value)) : M1(Math.abs(value))) : amount(value)}`;
const tone = (value: number) => (value > 0 ? "is-up" : value < 0 ? "is-down" : "");
const posLabel = { GK: "GAR", DF: "DEF", MF: "MIL", FW: "ATT" } as const;

const homeIcon = <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3 2 11.5V21h7v-6h6v6h7v-9.5z" /></svg>;
export function Breadcrumb({ clubId, club, player, detail, playerHref, backHref }: { clubId: string; club: string; player: string; detail?: boolean; playerHref: string; backHref: string }) {
  return (
    <nav className="pf-crumbs" aria-label="Fil d’Ariane">
      <Link href={backHref} aria-label="Joueurs">{homeIcon}</Link>
      <span>/</span><Link href={`/ligue-1/clubs/${clubId}`}>{club}</Link>
      <span>/</span>{detail ? <Link href={playerHref}>{player}</Link> : <em>{player}</em>}
      {detail && <><span>/</span><em>Détails</em></>}
    </nav>
  );
}

const arrowUp = <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 9 9 3M4.5 3H9v4.5" /></svg>;
const arrowDown = <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3l6 6M9 4.5V9H4.5" /></svg>;

type Props = { profile: PlayerProfile; basePath?: string; query?: Record<string, string | undefined>; defaultOpen?: number };

export function PlayerProfileView({ profile, basePath = "/joueurs", query = {}, defaultOpen }: Props) {
  const owned = profile.owned;
  const name = `${profile.firstName} ${profile.lastName}`.trim();
  const rest = new URLSearchParams(Object.entries(query).filter(([, v]) => v) as [string, string][]);
  const detailHref = `${basePath}?${new URLSearchParams({ ...Object.fromEntries(rest), player: profile.id, detail: "activity" })}`;
  const total = profile.market.buys + profile.market.sells;
  const buyShare = total ? (profile.market.buys / total) * 100 : 50;
  const date = owned ? new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "Europe/Paris" }).format(new Date(owned.acquiredAt)) : "";
  const time = owned ? new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).format(new Date(owned.acquiredAt)).replace(":", "h") : "";
  return (
    <div className="pf">
      <Breadcrumb clubId={profile.club.id} club={profile.club.short} player={profile.lastName} playerHref="#" backHref={`${basePath}${rest.size ? `?${rest}` : ""}`} />

      <header className="pf-banner" style={{ backgroundImage: "url(/images/player/banner.jpg)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="pf-shirt" src={getJerseyTrimImage(profile.club.name)} alt="" width={190} />
        <div className="pf-name">
          <span>{profile.firstName}</span>
          <h1>{profile.lastName.toUpperCase()}</h1>
          <p className="pf-tags"><b>{profile.club.code}</b><b>{posLabel[profile.position]}</b></p>
          <p className="pf-form" aria-label="Forme récente">{profile.form.map((r, i) => <b key={i} className={`is-${r}`}>{r}</b>)}</p>
        </div>
        <div className="pf-price">
          <strong>{M(profile.value)}</strong>
          <span className={`pf-delta ${profile.changePct < 0 ? "is-down" : ""}`}>
            <svg width="9" height="6" viewBox="0 0 9 6" fill="currentColor" aria-hidden="true">{profile.changePct < 0 ? <path d="M0 0h9L4.5 5.2z" /> : <path d="M4.5 0 9 5.2H0z" />}</svg>
            {Math.abs(profile.changePct).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
          </span>
        </div>
      </header>

      <div className="pf-cards">
        <section className="pf-card-box pf-c1" aria-label={owned ? "Valeur dans mon effectif" : "Valeur Marketfoot"}>
          <h2 className="pf-card-head">{owned ? "Valeur dans mon effectif" : "Valeur Marketfoot"}</h2>
          <dl>
            {owned ? <div><dt>Achat le {date} à {time}</dt><dd>{M(owned.acquiredValue)}</dd></div> : <div><dt>Valeur initiale</dt><dd>{M(profile.initialValue)}</dd></div>}
            <div><dt>Primes</dt><dd className={tone(profile.primes) || "is-up"}>{spaced(profile.primes)}</dd></div>
            <div><dt>{owned ? "Mercato" : "Total Mercato"}</dt><dd className="is-blue">{spaced(owned ? profile.mercatoSincePurchase : profile.mercatoTotal, 1)}</dd></div>
            <div><dt>Détenteurs</dt><dd>{profile.holders}</dd></div>
          </dl>
        </section>

        <section className="pf-card-box pf-c2" aria-label="Performances">
          <h2 className="pf-card-head">Performances</h2>
          <dl>
            <div><dt>Matchs joués (titulaires)</dt><dd>{profile.perf.played} ({profile.perf.started})</dd></div>
            <div><dt>Non joués</dt><dd>{profile.perf.notPlayed}</dd></div>
            <div><dt>Buts marqués (penalty)</dt><dd>{profile.perf.goals} ({profile.perf.penalties})</dd></div>
            <div><dt>Passes décisives</dt><dd>{profile.perf.assists}</dd></div>
            <div><dt>Cartons</dt><dd className="pf-cards-count">{profile.perf.yellow}<i className="pf-card pf-card--yellow" />{profile.perf.red}<i className="pf-card pf-card--red" /></dd></div>
          </dl>
        </section>

        <section className="pf-card-box pf-c3" aria-label="Activité sur le marché">
          <h2 className="pf-card-head">Activité sur le marché<Link href={detailHref}>{owned ? "Voir les détails" : "Voir en détail"}</Link></h2>
          <div className="pf-market">
            <p className="pf-counts"><span><b>{profile.market.buys}</b> achats</span><span><b>{profile.market.sells}</b> ventes</span></p>
            <p className="pf-ratio" aria-hidden="true"><i style={{ width: `${buyShare}%` }} /><i /></p>
          </div>
          <dl>
            <div><dt>Aujourd’hui</dt><dd className="pf-today"><span className="is-up">{profile.market.todayBuys}{arrowUp}</span><span className="is-down">{profile.market.todaySells}{arrowDown}</span></dd></div>
            <div>{owned ? <><dt>Valeur initale</dt><dd>{M(profile.initialValue)}</dd></> : <><dt>Dernier mercato</dt><dd className="is-blue">{spaced(profile.mercatoLast, 1)}</dd></>}</div>
            {owned && <div><dt>Total mercato</dt><dd className="is-blue">{spaced(profile.mercatoTotal, 1)}</dd></div>}
          </dl>
        </section>
      </div>

      <PrimeHistory rows={profile.rows} chart={profile.chart} defaultOpen={defaultOpen} />
      <span className="sr-only">{name}</span>
    </div>
  );
}

export type ActivityFilter = "tout" | "achats" | "ventes" | "primes" | "mercato";
const tabs: [ActivityFilter, string][] = [["tout", "Tout"], ["achats", "Achats"], ["ventes", "Ventes"], ["primes", "Primes"], ["mercato", "Mercato"]];
const kindOf: Record<ActivityFilter, ActivityEvent["kind"] | null> = { tout: null, achats: "achat", ventes: "vente", primes: "primes", mercato: "mercato" };
const dayFmt = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Paris" });
const timeFmt = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });

export function PlayerActivityView({ player, filter, basePath = "/joueurs", query = {} }: { player: { id: string; firstName: string; lastName: string; clubId: string; clubShort: string; events: ActivityEvent[] }; filter: ActivityFilter; basePath?: string; query?: Record<string, string | undefined> }) {
  const events = player.events.filter((event) => !kindOf[filter] || event.kind === kindOf[filter]);
  const href = (next: ActivityFilter) => `${basePath}?${new URLSearchParams({ ...(Object.fromEntries(Object.entries(query).filter(([, v]) => v)) as Record<string, string>), player: player.id, detail: "activity", ...(next === "tout" ? {} : { filter: next }) })}`;
  const groups = new Map<string, ActivityEvent[]>();
  for (const event of events) { const key = dayFmt.format(new Date(event.at)); groups.set(key, [...(groups.get(key) ?? []), event]); }
  const profileHref = `${basePath}?${new URLSearchParams({ ...(Object.fromEntries(Object.entries(query).filter(([, v]) => v)) as Record<string, string>), player: player.id })}`;
  return (
    <div className="pf pf--activity">
      <Breadcrumb clubId={player.clubId} club={player.clubShort} player={player.lastName} detail playerHref={profileHref} backHref={`${basePath}${Object.keys(query).filter((k) => query[k] && !["variant"].includes(k)).length ? `?${new URLSearchParams(Object.entries(query).filter(([k, v]) => v && k !== "variant") as [string, string][])}` : ""}`} />
      <nav className="pl-sub pf-tabs" aria-label="Type de mouvement">
        {tabs.map(([id, label]) => <Link key={id} href={href(id)} className={filter === id ? "is-active" : undefined}>{label}</Link>)}
      </nav>
      <div className="pf-ledger">
        <div className="pf-lhead"><span>Date</span><span>Mouvement</span><span>Impact +/-</span><span>Valeur joueur</span></div>
        {groups.size ? [...groups.entries()].map(([day, list]) => (
          <section key={day}>
            <h3 className="pf-day">{day}</h3>
            {list.map((event) => (
              <div key={event.id} className="pf-event">
                <span>{timeFmt.format(new Date(event.at)).replace(":", ":")}</span>
                <span><i className={`pf-chip pf-chip--${event.kind}`}>{event.label}</i></span>
                <b className={event.impact >= 0 ? "is-up" : "is-down"}>{event.impact >= 0 ? "+" : "-"}{amount(event.impact)}</b>
                <span className="pf-val">{M(event.value)}</span>
              </div>
            ))}
          </section>
        )) : <p className="pf-empty">Aucun mouvement enregistré pour ce joueur.</p>}
      </div>
    </div>
  );
}
