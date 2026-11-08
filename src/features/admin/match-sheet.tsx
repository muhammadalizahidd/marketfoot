"use client";

import { useMemo, useState } from "react";

import { Feedback, useKeepValuesAction } from "@/components/admin/client";
import { calculatePlayerMatchEffect, setRulesSettings, type RulesSettings } from "@/rules";
import { formatCompactEuro } from "@/lib/admin/format";
import { saveMatchSheet } from "./saisie-actions";

export type SheetRow = { playerId: string; name: string; position: "GK" | "DF" | "MF" | "FW"; clubId: string; started: boolean; minutes: number; goals: number; assists: number; penalties_scored: number; own_goals: number; penalties_missed: number; yellow_cards: number; red_cards: number; saves: number; stoppage_time_goals: number };
export type SheetCandidate = { id: string; name: string; position: SheetRow["position"]; clubId: string };

const columns = [
  ["goals", "⚽", "Buts"], ["assists", "👟", "Passes décisives"], ["penalties_scored", "🥅", "Pénaltys marqués"], ["own_goals", "⚪", "Buts contre son camp"],
  ["penalties_missed", "❌", "Pénaltys manqués"], ["yellow_cards", "🟨", "Cartons jaunes"], ["red_cards", "🟥", "Cartons rouges"], ["saves", "🧤", "Arrêts"], ["stoppage_time_goals", "⏱", "Buts en temps additionnel"],
] as const;
const posLetter = { GK: "G", DF: "D", MF: "M", FW: "A" } as const;
const order = ["GK", "DF", "MF", "FW"];

/** Full match sheet (UI/Admin "Saisie feuille de match"): score, both squads, live primes, draft / validate. */
export function MatchSheet({ matchId, settings, home, away, initialHome, initialAway, rows: initialRows, candidates, locked, status }: {
  matchId: string; settings: RulesSettings; home: { id: string; name: string }; away: { id: string; name: string };
  initialHome: number | null; initialAway: number | null; rows: SheetRow[]; candidates: SheetCandidate[]; locked: boolean; status: string;
}) {
  setRulesSettings(settings);
  const { state, onSubmit, pending } = useKeepValuesAction(saveMatchSheet);
  const [homeScore, setHomeScore] = useState(initialHome ?? 0);
  const [awayScore, setAwayScore] = useState(initialAway ?? 0);
  const [rows, setRows] = useState<SheetRow[]>(() => [...initialRows].sort((a, b) => Number(b.started) - Number(a.started) || order.indexOf(a.position) - order.indexOf(b.position) || a.name.localeCompare(b.name)));
  const [removed, setRemoved] = useState<string[]>([]);
  const [query, setQuery] = useState("");

  const update = (playerId: string, patch: Partial<SheetRow>) => setRows((current) => current.map((row) => (row.playerId === playerId ? { ...row, ...patch } : row)));
  const primes = (row: SheetRow) => {
    try {
      const conceded = row.clubId === home.id ? awayScore : homeScore;
      return calculatePlayerMatchEffect(row.position, { started: row.started, minutesPlayed: row.minutes, goals: row.goals, assists: row.assists, ownGoals: row.own_goals, yellowCards: row.yellow_cards, redCards: row.red_cards, penaltiesScored: row.penalties_scored, penaltiesMissed: row.penalties_missed, penaltiesSaved: 0, saves: row.saves, substitutionsOut: row.started && row.minutes > 0 && row.minutes < 90 && row.red_cards === 0 ? 1 : 0, goalsConceded: conceded });
    } catch { return null; }
  };
  const taken = new Set(rows.map((row) => row.playerId));
  const matches = useMemo(() => candidates.filter((c) => !taken.has(c.id) && c.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8), [candidates, query, rows]); // eslint-disable-line react-hooks/exhaustive-deps

  const table = (club: { id: string; name: string }) => {
    const list = rows.filter((row) => row.clubId === club.id);
    const adds = matches.filter((c) => c.clubId === club.id);
    return (
      <div className="ad-card" key={club.id}>
        <div className="ad-table-scroll">
          <table className="ad-table ad-sheet">
            <thead><tr><th>Poste</th><th>{club.name}</th><th title="Titulaire">T</th><th>Min.</th>{columns.map(([key, icon, label]) => <th key={key} title={label} aria-label={label}>{icon}</th>)}<th>Primes</th><th /></tr></thead>
            <tbody>
              {list.map((row) => {
                const value = primes(row);
                return (
                  <tr key={row.playerId}>
                    <td><span className={`ad-pos ad-pos--${row.position}`}>{posLetter[row.position]}</span></td>
                    <td>{row.name}</td>
                    <td><input type="checkbox" name={`s.${row.playerId}.started`} value="true" checked={row.started} disabled={locked} onChange={(event) => update(row.playerId, { started: event.target.checked, minutes: event.target.checked && row.minutes === 0 ? 90 : row.minutes })} aria-label={`${row.name} titulaire`} /></td>
                    <td><input type="number" min={0} max={130} name={`s.${row.playerId}.minutes`} value={row.minutes} disabled={locked} onChange={(event) => update(row.playerId, { minutes: Number(event.target.value) || 0 })} aria-label={`${row.name} minutes`} /></td>
                    {columns.map(([key, , label]) => (
                      <td key={key}><input type="number" min={0} name={`s.${row.playerId}.${key}`} value={row[key]} disabled={locked} onChange={(event) => update(row.playerId, { [key]: Number(event.target.value) || 0 } as Partial<SheetRow>)} aria-label={`${row.name} ${label}`} /></td>
                    ))}
                    <td style={{ whiteSpace: "nowrap" }}>{value === null ? "—" : formatCompactEuro(value)}</td>
                    <td>{!locked && <button type="button" className="ad-icon-btn" aria-label={`Retirer ${row.name}`} onClick={() => { setRows((current) => current.filter((r) => r.playerId !== row.playerId)); setRemoved((current) => [...current, row.playerId]); }}>×</button>}</td>
                  </tr>
                );
              })}
              {!list.length && <tr><td colSpan={columns.length + 5} className="ad-empty">Aucun joueur. Ajoutez-les ou pré-remplissez la feuille.</td></tr>}
            </tbody>
          </table>
        </div>
        {!locked && adds.length > 0 && query.trim() && (
          <div className="ad-menu-list" style={{ position: "static", boxShadow: "none" }}>
            {adds.map((c) => <button type="button" key={c.id} onClick={() => { setRows((current) => [...current, { playerId: c.id, name: c.name, position: c.position, clubId: c.clubId, started: false, minutes: 0, goals: 0, assists: 0, penalties_scored: 0, own_goals: 0, penalties_missed: 0, yellow_cards: 0, red_cards: 0, saves: 0, stoppage_time_goals: 0 }]); setRemoved((current) => current.filter((id) => id !== c.id)); setQuery(""); }}><span>{c.name}</span><em>+</em></button>)}
          </div>
        )}
      </div>
    );
  };

  return (
    <form onSubmit={onSubmit} className="ad-stack">
      <input type="hidden" name="matchId" value={matchId} />
      {removed.map((id) => <input key={id} type="hidden" name="remove" value={id} />)}
      <div className="ad-card">
        <div className="ad-score" aria-label="Score">
          <span>{home.name}</span>
          <input type="number" min={0} max={30} name="home_score" value={homeScore} disabled={locked} onChange={(event) => setHomeScore(Number(event.target.value) || 0)} aria-label={`Buts ${home.name}`} />
          <input type="number" min={0} max={30} name="away_score" value={awayScore} disabled={locked} onChange={(event) => setAwayScore(Number(event.target.value) || 0)} aria-label={`Buts ${away.name}`} />
          <span>{away.name}</span>
        </div>
      </div>
      {!locked && <div style={{ maxWidth: 360 }}><input className="ad-input ad-input--search" placeholder="Ajouter un joueur" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Ajouter un joueur" /></div>}
      <div className="ad-grid-2">{table(home)}{table(away)}</div>
      <Feedback state={state} />
      {locked ? <p className="ad-note ad-note--warn">Cette journée est réglée : annulez le règlement (correction historique) pour modifier la feuille.</p> : (
        <div className="ad-form-actions">
          <span className="ad-muted" style={{ alignSelf: "center" }}>Statut : {status === "validated" ? "validée" : status === "draft" ? "brouillon" : "non saisie"}</span>
          <button type="submit" name="intent" value="draft" className="ad-btn ad-btn--ghost" disabled={pending}>Enregistrer en tant que brouillon</button>
          <button type="submit" name="intent" value="validate" className="ad-btn" disabled={pending}>{pending ? "Enregistrement…" : "Valider"}</button>
        </div>
      )}
    </form>
  );
}
