"use client";

import { useState } from "react";

import type { HistoryRow, PlayerPrime } from "@/data/repositories/performance-repository";

const M = (value: number) => `${(value / 1_000_000).toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} M€`;
const money = (value: number) => (Math.abs(value) >= 1_000_000 ? M(value) : `${Math.round(value / 1000).toLocaleString("fr-FR")} k€`);
const signed = (value: number) => `${value > 0 ? "+" : value < 0 ? "-" : ""}${money(Math.abs(value))}`;
const when = (iso: string) => {
  const parts = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} - ${get("hour")}h${get("minute")}`;
};
const chevron = (open: boolean) => <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{open ? <path d="m3 7.5 3-3 3 3" /> : <path d="m3 4.5 3 3 3-3" />}</svg>;
const letter = { GK: "G", DF: "D", MF: "M", FW: "A" } as const;

function PrimeList({ title, list }: { title: string; list: PlayerPrime[] }) {
  const order = { GK: 0, DF: 1, MF: 2, FW: 3 } as const;
  return (
    <section className="gp-sub">
      <h3>{title}</h3>
      {list.length ? <ul>{[...list].sort((a, b) => order[a.position] - order[b.position]).map((p, i) => <li key={`${p.name}-${i}`}><b className={`cp-pos cp-pos--${letter[p.position]}`}>{letter[p.position]}</b><span>{p.name}</span><em>{signed(p.amount)}</em></li>)}</ul> : <p className="gp-none">Aucune prime enregistrée.</p>}
    </section>
  );
}

/** "Historique": one row per settled matchday, expandable to transfers and per-player primes (Figma Gamer Form – Performance). */
export function HistoryTable({ rows, defaultOpen }: { rows: HistoryRow[]; defaultOpen?: number }) {
  const [open, setOpen] = useState<number | null>(defaultOpen ?? null);
  return (
    <section className="gp-box gp-history" aria-label="Historique">
      <h2 className="gp-head">Historique</h2>
      <div className="gp-table">
        <div className="gp-hrow gp-hhead"><span>J</span><span>Période</span><span>Classement journée</span><span>Performances</span><span>Pronostics</span><span>Gains totaux</span><span>Trophées</span><span className="chev">{chevron(false)}</span></div>
        {rows.length ? rows.map((row) => {
          const expanded = open === row.day;
          return (
            <div key={row.day} className={`gp-item${expanded ? " is-open" : ""}`}>
              <button type="button" className="gp-hrow" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : row.day)}>
                <b>J{row.day}</b>
                <span>{row.rank ?? "—"} ème {row.rankDelta ? <i className={row.rankDelta > 0 ? "is-up" : "is-down"}>{row.rankDelta > 0 ? "↗ + " : "↘ - "}{Math.abs(row.rankDelta)}</i> : null}</span>
                <span>{row.dayRank ? `${row.dayRank} ème` : "—"}</span>
                <span>{money(row.starters)}</span>
                <span>{money(row.predictions)}</span>
                <span>{money(row.total)}</span>
                <span>{row.trophies.length ? row.trophies.join(", ") : "-"}</span>
                <span className="chev">{chevron(expanded)}</span>
              </button>
              {expanded && (
                <div className="gp-detail">
                  <section className="gp-sub gp-bonus" aria-label="Bonus joué">
                    <h3>Bonus</h3>
                    {row.bonus ? (
                      <div className="gp-bonus-card">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/images/bonus/${row.bonus.image}.png`} alt="" width={48} height={48} />
                        <div><b>{row.bonus.title}</b><p>{row.bonus.text}</p></div>
                        <em className={row.bonus.succeeded === null ? "" : row.bonus.succeeded ? "is-up" : "is-down"}>{row.bonus.succeeded === null ? "En attente" : row.bonus.succeeded ? `Réussi${row.bonus.amount ? ` ${signed(row.bonus.amount)}` : ""}` : "Raté"}</em>
                      </div>
                    ) : <p className="gp-none">Aucun bonus joué sur cette journée.</p>}
                  </section>
                  <section className="gp-sub gp-transfers">
                    <h3>Transferts</h3>
                    {row.transfers.length ? <ul>{row.transfers.map((t, i) => (
                      <li key={i}>
                        <i className={`gp-kind gp-kind--${t.kind}`}>{t.kind}</i><time>{when(t.at)}</time>
                        <span>{t.sold} ({M(t.soldValue)})</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0b5fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12h16M14 6l6 6-6 6" /></svg><span>{t.bought} ({M(t.boughtValue)})</span>
                        <em className={t.delta >= 0 ? "is-up" : "is-down"}>{t.delta >= 0 ? "+" : "-"}{M(Math.abs(t.delta))}</em>
                      </li>))}</ul> : <p className="gp-none">Aucun transfert sur cette journée.</p>}
                  </section>
                  <div className="gp-two">
                    <PrimeList title="Primes titulaires" list={row.startersDetail} />
                    <PrimeList title="Primes banc de touche" list={row.benchDetail} />
                  </div>
                </div>
              )}
            </div>
          );
        }) : <p className="gp-none">Aucune journée réglée pour le moment.</p>}
      </div>
    </section>
  );
}
