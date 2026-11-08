"use client";

import { useState } from "react";

import type { SeasonHonours } from "@/data/repositories/gamer-repository";

const chevron = (open: boolean) => <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{open ? <path d="m3 7.5 3-3 3 3" /> : <path d="m3 4.5 3 3 3-3" />}</svg>;
const ordinal = (rank: number | null) => (rank === null ? "—" : rank === 1 ? "1er" : `${rank}e`);

/** Season-by-season honours summary (Figma "Palmarès" history): season, final rank, points, expandable details. */
export function SeasonHistory({ seasons }: { seasons: SeasonHonours[] }) {
  const [open, setOpen] = useState<string | null>(seasons[1]?.seasonId ?? null);
  return (
    <section className="gp-seasons" aria-label="Historique des saisons">
      <div className="gp-srow gp-shead"><span>Saison</span><span>Classement</span><span>Points</span><span className="chev">{chevron(false)}</span></div>
      {seasons.length ? seasons.map((season) => {
        const expanded = open === season.seasonId;
        return (
          <div key={season.seasonId} className={`gp-sitem${expanded ? " is-open" : ""}`}>
            <button type="button" className="gp-srow" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : season.seasonId)}>
              <span>Saison {season.season}</span><span>{ordinal(season.overallRank)}</span><span>{season.points}</span><span className="chev">{chevron(expanded)}</span>
            </button>
            {expanded && (
              <ul>{season.lines.length ? season.lines.map((line) => (
                // eslint-disable-next-line @next/next/no-img-element
                <li key={line.label}><img src={`/images/trophies/${line.icon}.png`} alt="" /><span>{line.label}</span></li>
              )) : <li><span>Aucun trophée cette saison.</span></li>}</ul>
            )}
          </div>
        );
      }) : <p className="gp-none">Aucune saison terminée pour le moment.</p>}
    </section>
  );
}
