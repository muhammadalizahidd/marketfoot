import type { ReactNode } from "react";

import { getJerseyImage } from "@/lib/jersey-map";

export type DisplayMode = "value" | "speculation" | "owners";

export type PitchPlayer = {
  id: string;
  name: string;
  clubName?: string;
  value: number;
  /** Percentage change since the gamer bought the player. */
  changePct?: number;
  /** Amount gained or lost (euros) over the speculation period. */
  speculation?: number;
  /** Number of gamers holding the player. */
  owners?: number;
  isCaptain?: boolean;
  frozen?: boolean;
};

const mEuro = (value: number) => `${(value / 1_000_000).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} M€`;
const kEuro = (value: number) => `${value < 0 ? "-" : ""}${Math.abs(Math.round(value / 1000)).toLocaleString("fr-FR")} k€`;

function Arrow({ up }: { up: boolean }) {
  return <svg width="9" height="7" viewBox="0 0 9 7" aria-hidden="true"><path d={up ? "M4.5 0 9 7H0z" : "M4.5 7 0 0h9z"} fill="currentColor" /></svg>;
}

function Metric({ player, mode }: { player: PitchPlayer; mode: DisplayMode }) {
  if (mode === "owners") return <span className="tm-pill tm-pill--owners">{player.owners ?? "—"}</span>;
  if (mode === "speculation") {
    const amount = player.speculation ?? 0;
    return <span className={`tm-pill ${amount < 0 ? "is-down" : amount > 0 ? "is-up" : "is-flat"}`}>{kEuro(amount)}</span>;
  }
  const pct = Math.round(player.changePct ?? 0);
  return (
    <span className={`tm-pill ${pct < 0 ? "is-down" : pct > 0 ? "is-up" : "is-flat"}`}>
      {Math.abs(pct)}%{pct !== 0 && <Arrow up={pct > 0} />}
    </span>
  );
}

export type PlayerCardProps = {
  player?: PitchPlayer;
  position: string;
  mode: DisplayMode;
  state?: { selected?: boolean; eligible?: boolean; ineligible?: boolean };
  disabled?: boolean;
  onSelect?: () => void;
};

/** Jersey + white info card (Figma 90 x 62 card, 40 x 37 jersey). */
export function PlayerCard({ player, position, mode, state = {}, disabled, onSelect }: PlayerCardProps) {
  if (!player) {
    return (
      <button type="button" className="tm-slot tm-slot--empty" onClick={onSelect} disabled={disabled} aria-label={`Ajouter un joueur (${position})`}>
        <span className="tm-slot-plus">+</span>
        <span className="tm-slot-pos">{position}</span>
      </button>
    );
  }
  const cls = ["tm-slot", state.selected && "is-selected", state.eligible && "is-eligible", state.ineligible && "is-ineligible", player.frozen && "is-frozen"].filter(Boolean).join(" ");
  return (
    <button type="button" className={cls} onClick={onSelect} disabled={disabled} aria-pressed={state.selected} title={player.frozen ? "Équipe figée" : `Voir le profil de ${player.name}`}>
      <span className="tm-jersey">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={getJerseyImage(player.clubName)} alt="" />
        {player.isCaptain && <span className="tm-captain" aria-label="Capitaine">C</span>}
      </span>
      <span className="tm-card">
        <span className="tm-card-name">{player.name}</span>
        <span className="tm-card-value">{mEuro(player.value)}</span>
        <Metric player={player} mode={mode} />
      </span>
    </button>
  );
}

/** Pitch markings: touchline, penalty areas, halfway line, centre circle (all measured from the 1440px frame). */
export function PitchMarkings() {
  return (
    <svg className="tm-markings" viewBox="0 0 499 646" preserveAspectRatio="none" aria-hidden="true" fill="none" stroke="#fff" strokeWidth="2">
      <path d="M22 0V626H479V0" />
      <path d="M94 0V84H410V0" />
      <path d="M205 84a50 50 0 0 0 98 0" />
      <path d="M22 291H479" />
      <circle cx="252" cy="291" r="50" />
      <path d="M94 626V495H410V626" />
      <path d="M180 626V584H323V626" />
      <path d="M205 495a50 50 0 0 1 98 0" />
      <path d="M22 606a20 20 0 0 0 20 20M479 606a20 20 0 0 1-20 20" />
    </svg>
  );
}

export function Pitch({ rows }: { rows: ReactNode[] }) {
  return (
    <div className="tm-pitch">
      <PitchMarkings />
      <div className="tm-pitch-rows">{rows.map((row, i) => <div className="tm-row" key={i}>{row}</div>)}</div>
    </div>
  );
}

export function Bench({ rows }: { rows: ReactNode[] }) {
  return (
    <div className="tm-bench">
      <div className="tm-pitch-rows">{rows.map((row, i) => <div className="tm-row tm-row--bench" key={i}>{row}</div>)}</div>
    </div>
  );
}

const modes: { id: DisplayMode; label: string }[] = [
  { id: "value", label: "Valeur" },
  { id: "speculation", label: "Spéculation" },
  { id: "owners", label: "Possesseur" },
];

export function DisplayModeSwitch({ mode, onChange }: { mode: DisplayMode; onChange: (mode: DisplayMode) => void }) {
  return (
    <div className="tm-switch" role="tablist" aria-label="Affichage des joueurs">
      {modes.map((item) => (
        <button key={item.id} type="button" role="tab" aria-selected={mode === item.id} className={mode === item.id ? "is-active" : undefined} onClick={() => onChange(item.id)}>
          {item.label}
        </button>
      ))}
    </div>
  );
}
