import { HelpTip } from "@/components/team/help-tip";

import { getJerseyImage } from "@/lib/jersey-map";
import { clubCode } from "@/lib/club-codes";

export type CaptainCandidate = { id: string; name: string; clubName?: string; captainUses: number; frozen?: boolean };

export const CAPTAIN_MAX_USES = 6;

/** "Kvaratskhelia" stays as is; "Khvicha Kvaratskhelia" becomes "K. Kvaratskhelia". */
function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(" ")}` : name;
}

/** Right-hand Captain panel (Figma "Captain"): starters with checkbox, club chip, usage counter and profile link. */
export function CaptainPanel({ players, selectedId, onSelect, onOpenPlayer, disabled }: { players: CaptainCandidate[]; selectedId: string; onSelect: (id: string) => void; onOpenPlayer?: (id: string) => void; disabled?: boolean }) {
  return (
    <aside className="tm-panel" aria-label="Capitaine">
      <header className="tm-panel-head">
        <h2>
          Capitaine
          <HelpTip text="Choisis ton capitaine parmi tes titulaires : ses primes seront doublées lors de la prochaine journée. Chaque joueur ne peut être capitaine que 6 fois par saison." />
        </h2>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M14.8 9.2a3.5 3.5 0 1 0 0 5.6" /></svg>
      </header>
      <ul className="tm-cap-list">
        {players.map((player) => {
          const selected = player.id === selectedId;
          const exhausted = player.captainUses >= CAPTAIN_MAX_USES;
          const title = exhausted
            ? "Ce joueur a déjà été capitaine 6 fois, ses primes ne seront plus doublées"
            : player.frozen ? "Équipe figée" : `Capitaine ${player.captainUses} fois`;
          return (
            <li key={player.id} className={`tm-cap-row${selected ? " is-selected" : ""}${player.frozen ? " is-frozen" : ""}`}>
              <button type="button" className="tm-cap-pick" role="checkbox" aria-checked={selected} disabled={disabled || player.frozen} onClick={() => onSelect(player.id)} title={title}>
                <span className={`tm-check${selected ? " is-checked" : ""}`} aria-hidden="true">{selected && <svg width="9" height="9" viewBox="0 0 12 12"><path d="m2 6.5 3 3 5-6" fill="none" stroke="#fff" strokeWidth="2" /></svg>}</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={getJerseyImage(player.clubName)} alt="" />
                <span className="tm-cap-name">
                  <span>{shortName(player.name)}</span>
                  <em>{clubCode(player.clubName)}</em>
                </span>
              </button>
              <span className={`tm-cap-count${selected ? " is-selected" : ""}${exhausted ? " is-exhausted" : ""}`} title={title}>{player.captainUses}/{CAPTAIN_MAX_USES}</span>
              <button type="button" className="tm-cap-eye" onClick={() => onOpenPlayer?.(player.id)} aria-label={`Voir le profil de ${player.name}`} title="Voir le profil rapide">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
