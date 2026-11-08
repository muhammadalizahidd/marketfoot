"use client";

import { useActionState, useMemo, useState } from "react";
import { one } from "@/lib/supabase/relation";
import { marketfootRulesConfig } from "@/rules";
import { createInitialSquad, type CreateSquadState } from "./actions";

type Position = "GK" | "DF" | "MF" | "FW";
type Player = { id: string; first_name: string; last_name: string; position: Position; marketfoot_value: number | string; clubs: { name: string }[] | null };
const initialState: CreateSquadState = {};
const format = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const positionLabels: Record<Position, string> = { GK: "gardiens", DF: "défenseurs", MF: "milieux", FW: "attaquants" };

export function TeamBuilder({ players, budget }: { players: Player[]; budget: number }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState(""); const [position, setPosition] = useState(""); const [club, setClub] = useState(""); const [maxPrice, setMaxPrice] = useState("");
  const [selectionMessage, setSelectionMessage] = useState<string | null>(null);
  const [state, action, pending] = useActionState(createInitialSquad, initialState);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const clubs = useMemo(() => [...new Set(players.map((p) => one(p.clubs)?.name).filter(Boolean) as string[])].sort(), [players]);
  const selectedPlayers = useMemo(() => players.filter((player) => selectedSet.has(player.id)), [players, selectedSet]);
  const chosenCost = useMemo(() => selectedPlayers.reduce((total, player) => total + Number(player.marketfoot_value), 0), [selectedPlayers]);
  const positionCounts = useMemo(() => selectedPlayers.reduce<Record<Position, number>>((counts, player) => ({ ...counts, [player.position]: counts[player.position] + 1 }), { GK: 0, DF: 0, MF: 0, FW: 0 }), [selectedPlayers]);
  const clubCounts = useMemo(() => selectedPlayers.reduce<Record<string, number>>((counts, player) => { const name = one(player.clubs)?.name ?? ""; return { ...counts, [name]: (counts[name] ?? 0) + 1 }; }, {}), [selectedPlayers]);
  const remainingBudget = budget - chosenCost;
  const filtered = players.filter((p) => `${p.first_name} ${p.last_name}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()) && (!position || p.position === position) && (!club || one(p.clubs)?.name === club) && (!maxPrice || Number(p.marketfoot_value) <= Number(maxPrice)));
  const toggle = (player: Player) => {
    if (selectedSet.has(player.id)) { setSelected((current) => current.filter((id) => id !== player.id)); setSelectionMessage(null); return; }
    const limit = marketfootRulesConfig.squad.positions[player.position];
    if (positionCounts[player.position] >= limit) { setSelectionMessage(`Vous pouvez sélectionner au maximum ${limit} ${positionLabels[player.position]}.`); return; }
    const playerClub = one(player.clubs)?.name ?? "";
    if ((clubCounts[playerClub] ?? 0) >= marketfootRulesConfig.squad.maxPlayersPerClub) { setSelectionMessage("Vous ne pouvez pas sélectionner plus de 4 joueurs du même club."); return; }
    if (selected.length >= marketfootRulesConfig.squad.size) { setSelectionMessage("Votre effectif compte déjà 19 joueurs."); return; }
    setSelected((current) => [...current, player.id]); setSelectionMessage(null);
  };
  return <section className="team-builder" aria-labelledby="builder-title"><header className="builder-head"><div><p className="eyebrow">Créer mon équipe</p><h1 id="builder-title">Choisissez vos 19 joueurs</h1><p>3 gardiens, 6 défenseurs, 5 milieux et 5 attaquants. Maximum 4 joueurs d’un même club.</p></div><strong aria-live="polite">{selectedPlayers.length}/19</strong><span aria-live="polite">Restant : {format.format(remainingBudget)}</span></header><div className="builder-position-counts" aria-label="Composition sélectionnée"><span>G {positionCounts.GK}/3</span><span>D {positionCounts.DF}/6</span><span>M {positionCounts.MF}/5</span><span>A {positionCounts.FW}/5</span></div><div className="builder-filters"><label>Rechercher<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nom du joueur" /></label><label>Poste<select value={position} onChange={(e) => setPosition(e.target.value)}><option value="">Tous</option><option value="GK">Gardien</option><option value="DF">Défenseur</option><option value="MF">Milieu</option><option value="FW">Attaquant</option></select></label><label>Club<select value={club} onChange={(e) => setClub(e.target.value)}><option value="">Tous</option>{clubs.map((item) => <option value={item} key={item}>{item}</option>)}</select></label><label>Prix max<input type="number" min="0" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="Sans limite" /></label></div>{selectionMessage && <p className="builder-selection-message" role="status">{selectionMessage}</p>}<div className="builder-list">{filtered.map((p) => <button type="button" className={`player-choice ${selectedSet.has(p.id) ? "is-selected" : ""}`} key={p.id} onClick={() => toggle(p)} aria-pressed={selectedSet.has(p.id)}><span className="position-badge">{p.position}</span><span><strong>{p.first_name} {p.last_name}</strong><small>{one(p.clubs)?.name ?? ""}</small></span><span>{format.format(Number(p.marketfoot_value))} {selectedSet.has(p.id) ? "✓" : "+"}</span></button>)}{!filtered.length && <p className="detail-empty">Aucun joueur ne correspond à ces filtres.</p>}</div><form action={action} noValidate className="builder-footer"><input name="playerIds" type="hidden" value={JSON.stringify(selected)}/>{state.error && <p className="form-error" role="alert">{state.error}</p>}<button className="primary-action" disabled={pending || selectedPlayers.length !== 19} type="submit">{pending ? "Création…" : "Créer mon équipe"}</button></form></section>;
}
