import Link from "next/link";

import { getJerseyImage } from "@/lib/jersey-map";

export type ClubPlayerRow = { id: string; name: string; position: string; order: number; value: number; matches: number; starters: number; goals: number; ownGoals: number; assists: number; penalties: number; yellow: number; red: number };
export type ClubFixtureTeam = { id: string; name: string; short?: string; score: number | null };
export type ClubFixture = { id: string; matchdayId: string; day: number; kickoff: string; home: ClubFixtureTeam; away: ClubFixtureTeam; postponed: boolean };
export type ClubSort = "matches" | "starters" | "goals" | "ownGoals" | "assists" | "penalties" | "yellow" | "red" | "value";

const eur = (value: number) => `${(value / 1_000_000).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} M€`;
const when = (iso: string) => {
  const parts = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} - ${get("hour")}:${get("minute")}`;
};

const chevron = <svg className="cp-chev" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 4.5 3 3 3-3" /></svg>;
const eye = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12z" /><circle cx="12" cy="12" r="3" /></svg>;

const columns: { key: ClubSort; label?: string; icon?: string }[] = [
  { key: "matches", label: "Matchs" },
  { key: "starters", label: "Titulaires" },
  { key: "goals", icon: "ball" },
  { key: "ownGoals", icon: "csc" },
  { key: "assists", icon: "boot" },
  { key: "penalties", icon: "net" },
  { key: "yellow", icon: "yellow" },
  { key: "red", icon: "red" },
];

function HeadIcon({ name }: { name: string }) {
  if (name === "yellow") return <i className="cp-card cp-card--yellow" />;
  if (name === "red") return <i className="cp-card cp-card--red" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={`cp-icon cp-icon--${name}`} src={`/images/club/${name}.png`} alt="" />;
}

type Props = {
  clubId: string;
  clubName: string;
  rows: ClubPlayerRow[];
  fixtures: ClubFixture[];
  sort?: ClubSort;
  showAll?: boolean;
  /** Base path used for the sort / "voir tout" links. */
  basePath?: string;
};

export function ClubProfile({ clubId, clubName, rows, fixtures, sort, showAll, basePath }: Props) {
  const path = basePath ?? `/ligue-1/clubs/${clubId}`;
  const link = (changes: { sort?: string; all?: boolean }) => {
    const params = new URLSearchParams();
    const nextSort = "sort" in changes ? changes.sort : sort;
    const nextAll = "all" in changes ? changes.all : showAll;
    if (nextSort) params.set("sort", nextSort);
    if (nextAll) params.set("all", "1");
    const text = params.toString();
    return `${path}${text ? `?${text}` : ""}`;
  };
  const jersey = getJerseyImage(clubName);
  const visible = rows.filter((row) => showAll || row.matches > 0 || rows.length <= 12);
  const ordered = [...visible].sort((a, b) => (sort ? (b[sort] as number) - (a[sort] as number) : a.order - b.order || b.value - a.value) || a.name.localeCompare(b.name, "fr"));
  const grouped = !sort;
  return (
    <div className="cp">
      <section className="cp-table" aria-label="Effectif">
        <div className="cp-head">
          <span className="cp-c-name">Nom</span>
          <span className="cp-c-pos">Poste</span>
          {columns.map((column) => (
            <Link key={column.key} href={link({ sort: sort === column.key ? undefined : column.key })} className="cp-c-num" aria-label={`Trier par ${column.label ?? column.key}`}>
              {column.icon ? <HeadIcon name={column.icon} /> : column.label}{chevron}
            </Link>
          ))}
          <Link href={link({ sort: sort === "value" ? undefined : "value" })} className="cp-c-value">Valeur{chevron}</Link>
        </div>
        <Link href={link({ all: !showAll })} className="cp-all">
          <span className={`cp-check${showAll ? " is-checked" : ""}`} aria-hidden="true" />
          Voir tout l’effectif
        </Link>
        {ordered.map((row, index) => (
          <div key={row.id} className={`cp-row${grouped && index > 0 && ordered[index - 1].order !== row.order ? " is-group" : ""}`}>
            <span className="cp-c-name">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={jersey} alt="" width={16} height={16} />{row.name}
            </span>
            <span className="cp-c-pos"><b className={`cp-pos cp-pos--${row.position}`}>{row.position}</b></span>
            <span className="cp-c-num">{row.matches}</span>
            <span className="cp-c-num">{row.starters}</span>
            <span className="cp-c-num">{row.goals}</span>
            <span className="cp-c-num">{row.ownGoals}</span>
            <span className="cp-c-num">{row.assists}</span>
            <span className="cp-c-num">{row.penalties}</span>
            <span className="cp-c-num">{row.yellow}</span>
            <span className="cp-c-num">{row.red}</span>
            <span className="cp-c-value">{eur(row.value)}</span>
            <Link href={`/joueurs?player=${row.id}`} className="cp-eye" aria-label={`Voir la fiche de ${row.name}`}>{eye}</Link>
          </div>
        ))}
        {!ordered.length && <p className="cp-empty">Aucun joueur pour ce club.</p>}
      </section>

      <section className="cp-calendar" aria-label="Calendrier">
        <h2>Calendrier</h2>
        <div className="cp-grid">
          {fixtures.map((fixture) => (
            <Link key={fixture.id} href={`/ligue-1?view=results&day=${fixture.matchdayId}&match=${fixture.id}`} className="cp-match">
              <span className="cp-match-meta"><b>J{fixture.day}</b><time dateTime={fixture.kickoff}>{when(fixture.kickoff)}</time></span>
              {[fixture.home, fixture.away].map((team, side) => (
                <span key={side} className="cp-team">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={getJerseyImage(team.name)} alt="" width={14} height={14} />
                  <span>{team.short ?? team.name}</span>
                  <strong>{fixture.postponed ? "" : team.score ?? ""}</strong>
                </span>
              ))}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
