"use client";

import { useState } from "react";

import type { MatchRow } from "@/data/repositories/player-profile-repository";

const kilo = (value: number) => `${value > 0 ? "+" : value < 0 ? "-" : ""}${Math.abs(Math.round(value / 1000)).toLocaleString("fr-FR")} k€`;
const date = (iso: string) => new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "Europe/Paris" }).format(new Date(iso));
const chevron = (open: boolean) => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{open ? <path d="m3 7.5 3-3 3 3" /> : <path d="m3 4.5 3 3 3-3" />}</svg>
);
const arrowUp = <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#10c64a" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 9 9 3M4.5 3H9v4.5" /></svg>;
const arrowDown = <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#ff2b2b" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3l6 6M9 4.5V9H4.5" /></svg>;

function Icons({ row, side }: { row: MatchRow; side: "bonus" | "malus" }) {
  const items: { key: string; node: React.ReactNode }[] = [];
  // eslint-disable-next-line @next/next/no-img-element
  const img = (name: string, key: string) => ({ key, node: <img key={key} className="pf-ico" src={`/images/players/${name}.png`} alt="" /> });
  if (side === "bonus") {
    for (let i = 0; i < Math.min(row.goals, 3); i++) items.push(img("ball", `g${i}`));
    for (let i = 0; i < Math.min(row.assists, 3); i++) items.push(img("boot", `a${i}`));
    if (row.cleanSheet) items.push(img("net", "cs"));
  } else {
    for (let i = 0; i < Math.min(row.yellow, 3); i++) items.push({ key: `y${i}`, node: <i key={`y${i}`} className="pf-card pf-card--yellow" /> });
    for (let i = 0; i < Math.min(row.red, 2); i++) items.push({ key: `r${i}`, node: <i key={`r${i}`} className="pf-card pf-card--red" /> });
    for (let i = 0; i < Math.min(row.ownGoals, 2); i++) items.push(img("redball", `o${i}`));
  }
  return <span className="pf-icons">{items.map((item) => item.node)}</span>;
}

/** "Historique de primes": per-matchday bar chart plus the expandable match-by-match table (Figma "Player Form"). */
export function PrimeHistory({ rows, chart, matchdays = 34, defaultOpen }: { rows: MatchRow[]; chart: { day: number; amount: number }[]; matchdays?: number; defaultOpen?: number }) {
  const [open, setOpen] = useState<number | null>(defaultOpen ?? null);
  // Figma axis: 18 px per +200 k€ above zero and 18 px per -100 k€ below it (losses are drawn twice as tall).
  const unit = 18;
  const posTop = Math.max(800_000, Math.ceil(Math.max(0, ...chart.map((c) => c.amount)) / 200_000) * 200_000);
  const negBottom = Math.min(-200_000, Math.floor(Math.min(0, ...chart.map((c) => c.amount)) / 100_000) * 100_000);
  const posTicks = Array.from({ length: posTop / 200_000 }, (_, i) => posTop - i * 200_000);
  const negTicks = Array.from({ length: -negBottom / 100_000 }, (_, i) => -(i + 1) * 100_000);
  const ticks = [...posTicks, 0, ...negTicks];
  const height = (ticks.length - 1) * unit;
  const zero = posTicks.length * unit;
  const barHeight = (amount: number) => Math.max(2, amount >= 0 ? (amount / 200_000) * unit : (-amount / 100_000) * unit);
  const byDay = new Map(chart.map((c) => [c.day, c.amount]));
  const days = Math.max(matchdays, ...chart.map((c) => c.day));
  return (
    <section className="pf-card-box pf-history" aria-label="Historique de primes">
      <h2 className="pf-card-head">Historique de primes</h2>
      <div className="pf-chart" style={{ height: height + 82 }}>
        <ul className="pf-yaxis" style={{ height }}>{ticks.map((t, i) => <li key={t} style={{ top: i * unit }}>{t === 0 ? "0 €" : kilo(t)}</li>)}</ul>
        <div className="pf-plot" style={{ height }}>
          {ticks.map((t, i) => <i key={t} className="pf-grid" style={{ top: i * unit }} />)}
          <div className="pf-bars" style={{ gridTemplateColumns: `repeat(${days}, 1fr)` }}>
            {Array.from({ length: days }, (_, i) => {
              const amount = byDay.get(i + 1);
              const h = amount === undefined ? 0 : barHeight(amount);
              return (
                <span key={i} className="pf-col">
                  {amount !== undefined && (
                    <button type="button" aria-label={`J${i + 1} : ${kilo(amount)}`} onClick={() => setOpen(open === i + 1 ? null : i + 1)}
                      className={`pf-bar ${amount >= 0 ? "is-up" : "is-down"}${open === i + 1 ? " is-selected" : ""}`}
                      style={amount >= 0 ? { bottom: height - zero, height: h } : { top: zero, height: h }} />
                  )}
                </span>
              );
            })}
          </div>
        </div>
        <div className="pf-xaxis" style={{ top: height + 39 }}><span>Gains</span><div style={{ gridTemplateColumns: `repeat(${days}, 1fr)` }}>{Array.from({ length: days }, (_, i) => <b key={i}>J{i + 1}</b>)}</div></div>
      </div>

      <div className="pf-matches">
        <div className="pf-mhead"><span>J</span><span>Date</span><span className="c-match">Match</span><span>Min.</span><span>Bonus</span><span>Malus</span><span className="c-dot">Dotations</span></div>
        {rows.length ? rows.map((row) => {
          const expanded = open === row.day;
          return (
            <div key={row.day} className={`pf-mrow${expanded ? " is-open" : ""}`}>
              <button type="button" className="pf-mline" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : row.day)}>
                <b>J{row.day}</b>
                <span>{date(row.kickoff)}</span>
                <span className="c-match"><em>{row.home}</em><i className={`pf-score is-${row.result}`}>{row.homeScore}-{row.awayScore}</i><em>{row.away}</em></span>
                <span className="c-min">{row.played ? <>{row.started ? (row.substitutedOut ? arrowDown : null) : arrowUp}{row.minutes}&apos;</> : "NJ"}</span>
                <span className="c-ico"><Icons row={row} side="bonus" /></span>
                <span className="c-ico"><Icons row={row} side="malus" /></span>
                <span className={`c-dot ${row.total >= 0 ? "is-up" : "is-down"}`}>{kilo(row.total)}{chevron(expanded)}</span>
              </button>
              {expanded && (
                <ul className="pf-lines">{row.lines.map((line) => <li key={line.key}><span>{line.label}</span><b>{kilo(line.amount)}</b></li>)}</ul>
              )}
            </div>
          );
        }) : <p className="pf-empty">Aucun match joué cette saison.</p>}
      </div>
    </section>
  );
}
