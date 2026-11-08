import Link from "next/link";

import { clubCode } from "@/lib/club-codes";
import { getJerseyImage } from "@/lib/jersey-map";
import type { PlayerTableRow, PlayersView as View, SpeculationPeriod } from "@/data/repositories/players-repository";

export type PlayersParams = {
  view: View;
  period: SpeculationPeriod;
  q?: string;
  position?: string;
  clubs: string[];
  min?: number;
  max?: number;
  sort?: string;
  dir: "asc" | "desc";
  page: number;
  size: number;
  open?: "prix" | "club" | "poste";
  player?: string;
};

type Props = {
  params: PlayersParams;
  rows: PlayerTableRow[];
  total: number;
  clubs: { id: string; name: string }[];
  seasonName: string;
  basePath?: string;
};

const M = (value: number) => `${(value / 1_000_000).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} M€`;
const full = (value: number) => `${Math.round(value).toLocaleString("fr-FR").replace(/[  ]/g, " ")} €`;
const money = (value: number) => (Math.abs(value) >= 1_000_000 ? M(value) : `${Math.round(value / 1000).toLocaleString("fr-FR")} k€`);

const caret = <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 4.5 3 3 3-3" /></svg>;
const arrow = <svg className="pl-arrow" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m4.5 3 3 3-3 3" /></svg>;

type Col = { key: string; label?: string; icon?: string; value: (row: PlayerTableRow) => string; sortable?: boolean };
const num = (key: keyof PlayerTableRow) => (row: PlayerTableRow) => String(row[key]);
const generalCols: Col[] = [
  { key: "value", label: "Valeur", value: (r) => M(r.value), sortable: true },
  { key: "initialValue", label: "Valeur initiale", value: (r) => M(r.initialValue), sortable: true },
  { key: "earnings", label: "Primes", value: (r) => M(r.earnings), sortable: true },
  { key: "lastEarning", label: "Dernière Prime", value: (r) => money(r.lastEarning), sortable: true },
  { key: "holders", label: "Détenteurs", value: num("holders"), sortable: true },
  { key: "lastMercato", label: "Dernier mercato", value: (r) => money(r.lastMercato), sortable: true },
];
const performanceCols: Col[] = [
  { key: "value", label: "Valeur", value: (r) => full(r.value), sortable: true },
  { key: "matches", label: "Matchs", value: num("matches"), sortable: true },
  { key: "starters", label: "Titulaires", value: num("starters"), sortable: true },
  { key: "goals", icon: "ball", value: num("goals"), sortable: true },
  { key: "assists", icon: "boot", value: num("assists"), sortable: true },
  { key: "saves", icon: "net", value: num("saves"), sortable: true },
  { key: "ownGoals", icon: "redball", value: num("ownGoals"), sortable: true },
  { key: "penalties", icon: "rednet", value: num("penalties"), sortable: true },
  { key: "yellow", icon: "yellow", value: num("yellow"), sortable: true },
  { key: "red", icon: "red", value: num("red"), sortable: true },
];
const speculationCols: Col[] = [
  { key: "value", label: "Valeur", value: (r) => M(r.value), sortable: true },
  { key: "initialValue", label: "Valeur initiale", value: (r) => M(r.initialValue), sortable: true },
  { key: "earnings", label: "Primes", value: (r) => M(r.earnings), sortable: true },
  { key: "buys", label: "Achats", value: num("buys"), sortable: true },
  { key: "sells", label: "Vente", value: num("sells"), sortable: true },
  { key: "holders", label: "Détenteurs", value: num("holders"), sortable: true },
  { key: "lastMercato", label: "Dernier mercato", value: (r) => money(r.lastMercato), sortable: true },
];

const positions: [string, string][] = [["", "Tous"], ["GK", "Gardiens"], ["DF", "Défenseurs"], ["MF", "Milieux"], ["FW", "Attaquants"]];
const periods: [SpeculationPeriod, string][] = [["all", "Depuis le début"], ["mercato", "Depuis le dernier mercato"], ["today", "Aujourd’hui"]];
const views: [View, string][] = [["general", "Général"], ["performance", "Performances"], ["speculation", "Spéculation"]];

function HeadIcon({ name }: { name: string }) {
  if (name === "yellow") return <i className="pl-card pl-card--yellow" />;
  if (name === "red") return <i className="pl-card pl-card--red" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="pl-icon" src={`/images/players/${name}.png`} alt="" />;
}

export function PlayersView({ params, rows, total, clubs, seasonName, basePath = "/joueurs" }: Props) {
  const href = (changes: Partial<Record<keyof PlayersParams, string | number | string[] | undefined>>) => {
    const merged: Record<string, string | number | string[] | undefined> = { ...params, ...changes };
    const search = new URLSearchParams();
    const set = (key: string, value: string | number | string[] | undefined) => { if (value !== undefined && value !== "" && !(Array.isArray(value) && !value.length)) search.set(key, Array.isArray(value) ? value.join(",") : String(value)); };
    if (merged.view !== "general") set("view", merged.view);
    if (merged.view === "speculation" && merged.period !== "all") set("period", merged.period);
    set("q", merged.q); set("position", merged.position); set("club", merged.clubs);
    set("min", merged.min); set("max", merged.max); set("sort", merged.sort);
    if (merged.sort && merged.dir === "asc") set("dir", "asc");
    if (Number(merged.page) > 1) set("page", merged.page);
    if (merged.size !== 10) set("size", merged.size);
    set("open", merged.open); set("player", merged.player);
    const text = search.toString();
    return `${basePath}${text ? `?${text}` : ""}`;
  };
  const sortHref = (key: string) => href({ sort: key, dir: params.sort === key && params.dir === "desc" ? "asc" : "desc", page: 1 });
  const cols = params.view === "general" ? generalCols : params.view === "performance" ? performanceCols : speculationCols;
  const pages = Math.max(1, Math.ceil(total / params.size));
  const first = total ? (params.page - 1) * params.size + 1 : 0;
  const last = Math.min(total, params.page * params.size);
  const filtersActive = { prix: params.min !== undefined || params.max !== undefined, club: params.clubs.length > 0, poste: Boolean(params.position) };
  const toggleOpen = (name: "prix" | "club" | "poste") => href({ open: params.open === name ? undefined : name });

  return (
    <div className={`pl pl--${params.view}`}>
      <div className="pl-top">
        <nav className="pl-tabs" aria-label="Vue du catalogue">
          {views.map(([id, label]) => (
            <Link key={id} href={href({ view: id, page: 1, sort: undefined, dir: "desc" })} className={params.view === id ? "is-active" : undefined} aria-current={params.view === id ? "page" : undefined}>{label}</Link>
          ))}
        </nav>
        <form className="pl-search" action={basePath} role="search">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input name="q" defaultValue={params.q} placeholder="Rechercher un joueur" aria-label="Rechercher un joueur" />
          {params.view !== "general" && <input type="hidden" name="view" value={params.view} />}
          {params.position && <input type="hidden" name="position" value={params.position} />}
          {params.clubs.length > 0 && <input type="hidden" name="club" value={params.clubs.join(",")} />}
        </form>
      </div>

      <div className="pl-filters">
        <div className="pl-chips">
          {([["prix", "Prix"], ["club", "Club"], ["poste", "Poste"]] as const).map(([id, label]) => (
            <Link key={id} href={toggleOpen(id)} className={`pl-chip${params.open === id || filtersActive[id] ? " is-active" : ""}`}>{label}{caret}</Link>
          ))}
        </div>
        <span className="pl-season">{seasonName}<svg width="8" height="8" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 4.5 3 3 3-3" /></svg></span>
      </div>

      {params.open === "prix" && (
        <form className="pl-price" action={basePath}>
          {params.view !== "general" && <input type="hidden" name="view" value={params.view} />}
          {params.q && <input type="hidden" name="q" value={params.q} />}
          <label><input type="number" name="min" step="0.01" min="0" defaultValue={params.min !== undefined ? params.min / 1_000_000 : ""} placeholder="Min (M€)" aria-label="Prix minimum en millions d’euros" /></label>
          <span className="pl-track" aria-hidden="true" />
          <label><input type="number" name="max" step="0.01" min="0" defaultValue={params.max !== undefined ? params.max / 1_000_000 : ""} placeholder="Max (M€)" aria-label="Prix maximum en millions d’euros" /></label>
          <button type="submit">Appliquer</button>
        </form>
      )}
      {params.open === "club" && (
        <div className="pl-clubs" role="group" aria-label="Clubs">
          {clubs.map((club) => {
            const selected = params.clubs.includes(club.id);
            const next = selected ? params.clubs.filter((id) => id !== club.id) : [...params.clubs, club.id];
            return (
              <Link key={club.id} href={href({ clubs: next, page: 1, open: "club" })} className={selected ? "is-active" : undefined} aria-pressed={selected}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/players/shirt.png" alt="" width={16} height={18} />{club.name}
              </Link>
            );
          })}
        </div>
      )}
      {params.open === "poste" && (
        <div className="pl-clubs" role="group" aria-label="Poste">
          {positions.map(([code, label]) => <Link key={code} href={href({ position: code || undefined, page: 1, open: "poste" })} className={(params.position ?? "") === code ? "is-active" : undefined}>{label}</Link>)}
        </div>
      )}

      <section className="pl-table" aria-label="Joueurs">
        {params.view === "speculation" ? (
          <nav className="pl-sub" aria-label="Période">
            {periods.map(([id, label]) => <Link key={id} href={href({ period: id, page: 1 })} className={params.period === id ? "is-active" : undefined}>{label}</Link>)}
          </nav>
        ) : (
          <nav className="pl-sub" aria-label="Poste">
            {positions.map(([code, label]) => <Link key={code} href={href({ position: code || undefined, page: 1 })} className={(params.position ?? "") === code ? "is-active" : undefined}>{label}</Link>)}
          </nav>
        )}
        <div className="pl-grid pl-head">
          <span className="pl-c-rank"><Link href={href({ sort: undefined, page: 1 })} className="pl-rankchip">Rang{caret}</Link></span>
          <Link href={sortHref("name")} className="pl-c-name">Nom{arrow}</Link>
          {cols.map((col) => (
            <Link key={col.key} href={sortHref(col.key)} className={`pl-c${params.sort === col.key ? " is-sorted" : ""}`} aria-label={`Trier par ${col.label ?? col.key}`}>
              {col.icon ? <HeadIcon name={col.icon} /> : col.label}{params.sort === col.key ? caret : arrow}
            </Link>
          ))}
        </div>
        {rows.length ? rows.map((row, index) => (
          <div key={row.id} className={`pl-grid pl-row${params.player === row.id ? " is-selected" : ""}`}>
            <span className="pl-c-rank">{(params.page - 1) * params.size + index + 1}</span>
            <Link href={href({ player: row.id })} className="pl-c-name">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={getJerseyImage(row.clubName)} alt="" width={16} height={16} /><b>{clubCode(row.clubName)}</b>{row.name}
            </Link>
            {cols.map((col) => <span key={col.key} className="pl-c">{col.value(row)}</span>)}
          </div>
        )) : <p className="pl-empty">Aucun joueur ne correspond à ces filtres.</p>}
        <footer className="pl-foot">
          <div>
            <span className="pl-sizechip">{params.size}{caret}</span>
            <span className="pl-muted">résultats par page</span>
            <span className="pl-count">{first}-{last} de {total} résultats</span>
          </div>
          <div>
            <span className="pl-sizechip">{params.page}{caret}</span>
            <span className="pl-count">sur {pages} pages</span>
            <Link href={href({ page: Math.max(1, params.page - 1) })} aria-label="Page précédente" className="pl-step"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg></Link>
            <Link href={href({ page: Math.min(pages, params.page + 1) })} aria-label="Page suivante" className="pl-step"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg></Link>
          </div>
        </footer>
      </section>
    </div>
  );
}
