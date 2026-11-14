import Link from "next/link";

import { getJerseyImage } from "@/lib/jersey-map";

export type PlayerPanelData = { id: string; name: string; clubName?: string; clubId?: string; position: string; value: number; acquiredValue?: number; owners?: number };

const mEuro = (value: number) => `${(value / 1_000_000).toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} M€`;

/** Quick-reference "Panel player" ("Select your player - Detail player"): opens to the left of the Captain / Transfer panel. */
export function PlayerPanel({ player, onClose }: { player: PlayerPanelData; onClose: () => void }) {
  const change = player.acquiredValue ? player.value - player.acquiredValue : undefined;
  return (
    <aside className="tm-player-panel" aria-label={`Fiche de ${player.name}`}>
      <header>
        <h2>{player.name}</h2>
        <button type="button" onClick={onClose} aria-label="Fermer">×</button>
      </header>
      <div className="tm-player-body">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={getJerseyImage(player.clubName)} alt="" />
        <dl>
          <dt>Poste</dt><dd>{player.position}</dd>
          <dt>Club</dt><dd>{player.clubName || "—"}</dd>
          <dt>Valeur</dt><dd>{mEuro(player.value)}</dd>
          {change !== undefined && <><dt>Variation depuis l’achat</dt><dd>{`${change > 0 ? "+" : change < 0 ? "−" : ""}${mEuro(Math.abs(change))}`}</dd></>}
          {player.owners !== undefined && <><dt>Possesseurs</dt><dd>{player.owners}</dd></>}
        </dl>
        <Link href={`/joueurs?player=${player.id}`}>Voir la fiche complète</Link>
      </div>
    </aside>
  );
}
