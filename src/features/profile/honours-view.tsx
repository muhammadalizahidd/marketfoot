import type { Honours } from "@/data/repositories/gamer-repository";
import { bandPoints, honoursBands, trophySections, type HonoursBand } from "@/rules";
import { selectTrophy } from "./actions";
import { SeasonHistory } from "./season-history";

const bandLabel = (band: HonoursBand) => (band === 1 ? <>1<sup>er</sup></> : band === 2 || band === 3 ? <>{band}<sup>e</sup></> : band === 10 ? <>4<sup>e</sup>–10<sup>e</sup></> : band === 20 ? <>11<sup>e</sup>–20<sup>e</sup></> : band === 30 ? <>21<sup>e</sup>–30<sup>e</sup></> : band === 50 ? <>31<sup>e</sup>–50<sup>e</sup></> : <>51<sup>e</sup>–100<sup>e</sup></>);
const ordinal = (rank: number) => <>{rank}<sup>{rank === 1 ? "er" : "e"}</sup></>;

export function HonoursView({ honours, owner }: { honours: Honours; owner: boolean }) {
  return (
    <>
      {owner && <p className="gp-info"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 11v6M12 7.5v.5" /></svg>Coche le trophée de ton choix, il apparaîtra dans ta carte de joueur et sur tous les classements de Marketfoot</p>}
      <div className="gp-stats">
        <article className="gp-stat is-blue"><h3>POINTS PALMARÈS</h3><b>{honours.totalPoints}</b><p>{honours.palmaresRank ? `${honours.palmaresRank}e au classement palmarès` : "Pas encore classé"}</p></article>
        <article className="gp-stat"><h3>TROPHÉES</h3><b>{honours.trophies}</b><p>{honours.distinct}/{honours.slots}</p></article>
        <article className="gp-stat"><h3>MEILLEUR CLASSEMENT</h3><b>{honours.best ? ordinal(honours.best.rank) : "—"}</b><p>{honours.best ? `Ligue 1 - Saison ${honours.best.season}` : "Aucune saison terminée"}</p></article>
      </div>

      <section className="gp-trophies" aria-label="Trophées">
        {trophySections.map((section) => (
          <div key={section.title} className="gp-tsection">
            <h3>{section.title}</h3>
            {section.rows.map((row) => (
              <ul key={row.key} className="gp-tgrid">
                {row.bands.map((band) => {
                  const key = `${row.category}:${band}`;
                  const tile = honours.tiles[key];
                  const selected = honours.selected === key;
                  const inner = (
                    <>
                      {tile && tile.count > 1 && <em className="gp-x">x{tile.count}</em>}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/images/trophies/${row.key}-${band}.png`} alt="" />
                      <strong>{tile ? ordinal(tile.bestRank) : bandLabel(band)}{row.label && !tile ? <small> {row.label}</small> : null}</strong>
                      <span>+{bandPoints(row.category, band)} pts</span>
                    </>
                  );
                  return (
                    <li key={key} className={`gp-tile${tile ? " is-won" : ""}${selected ? " is-selected" : ""}`}>
                      {tile && owner ? <form action={selectTrophy}><input type="hidden" name="key" value={key} /><button type="submit" aria-pressed={selected} title={selected ? "Retirer de ma carte" : "Afficher sur ma carte"}>{inner}</button></form> : <div>{inner}</div>}
                    </li>
                  );
                })}
                {Array.from({ length: honoursBands.length - row.bands.length }, (_, i) => <li key={`e${i}`} className="gp-tile is-empty" aria-hidden="true" />)}
              </ul>
            ))}
          </div>
        ))}
      </section>

      <SeasonHistory seasons={honours.seasons} />
    </>
  );
}
