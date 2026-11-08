/**
 * Bonus catalogue from PRD v1.3 §6.4 (Game Rules v2): six bonuses, one playable per matchday, each paying the same
 * share (Barèmes → Bonus, default +10 %) of the starters' primes when its event happens. Names and the per-season
 * maximum are still "pending client input" in the PRD, so the maximum lives in the Barèmes, not here.
 * Artwork comes from the Figma bonus set; "Fergie Time" has no dedicated artwork yet and reuses "prime-time".
 */
export const bonusCatalogue = [
  { id: "cholismo", image: "cholismo", title: "Le Cholismo", text: "Au moins 2 joueurs de ta compo gagnent leur match 1-0." },
  { id: "turpin", image: "la-chatte-a-dede", title: "Le Turpin", text: "Un joueur de ta compo inscrit un pénalty." },
  { id: "clean-sheets", image: "draps-propres", title: "Clean Sheets", text: "Ton gardien gagne son match sans encaisser de but." },
  { id: "sorti-du-frigo", image: "sorti-du-frigo", title: "Sorti du frigo", text: "Un joueur de ta compo sort du banc et marque." },
  { id: "caviar-en-stock", image: "caviar-en-stock", title: "Caviar en stock", text: "Un joueur de ta compo délivre deux passes décisives dans le même match." },
  { id: "fergie-time", image: "prime-time", title: "Fergie Time", text: "Un joueur de ta compo marque dans le temps additionnel." },
] as const;
export type BonusId = (typeof bonusCatalogue)[number]["id"];
