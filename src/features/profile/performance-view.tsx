import Link from "next/link";

import type { Performance } from "@/data/repositories/performance-repository";
import { HistoryTable } from "./history-table";

const M = (value: number) => `${(value / 1_000_000).toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} M€`;
const M1 = (value: number) => `${(value / 1_000_000).toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} M€`;
const money = (value: number) => (Math.abs(value) >= 1_000_000 ? M(value) : `${Math.round(value / 1000).toLocaleString("fr-FR")} k€`);
const sign = (value: number) => (value > 0 ? "+ " : value < 0 ? "- " : "");
const tone = (value: number) => (value > 0 ? "is-up" : value < 0 ? "is-down" : "");

const triangle = (down = false) => <svg width="9" height="6" viewBox="0 0 9 6" fill="currentColor" aria-hidden="true">{down ? <path d="M0 0h9L4.5 5.2z" /> : <path d="M4.5 0 9 5.2H0z" />}</svg>;

function RankCards({ ranks }: { ranks: Performance["ranks"] }) {
  return (
    <div className="gp-ranks">
      {ranks.map((card) => (
        <article key={card.label} className="gp-rank">
          <h3>{card.label}</h3>
          <b>{card.rank === null ? "—" : <>{card.rank}<sup>{card.rank === 1 ? "er" : "e"}</sup></>}</b>
          {card.delta !== null && card.delta !== 0 ? <span className={card.delta > 0 ? "is-up" : "is-down"}>{triangle(card.delta < 0)}{Math.abs(card.delta)}</span> : <span className="is-flat">&nbsp;</span>}
        </article>
      ))}
    </div>
  );
}

function Evolution({ points, total, days }: { points: Performance["evolution"]; total: number; days: number }) {
  const width = 854, height = 108, columns = Math.max(days, 34), step = width / columns;
  const x = (day: number) => (day - 0.5) * step;
  const y = (rank: number) => (total <= 1 ? height / 2 : ((rank - 1) / (total - 1)) * height);
  return (
    <section className="gp-box gp-evo" aria-label="Évolution au classement">
      <h2 className="gp-head">Évolution au classement</h2>
      <div className="gp-evo-plot">
        <span className="gp-evo-top">1er</span><span className="gp-evo-bottom">Dernier</span>
        <svg width={width} height={height + 34} viewBox={`0 -8 ${width} ${height + 34}`} role="img" aria-label="Rang général par journée">
          {Array.from({ length: 7 }, (_, i) => <line key={i} x1="0" x2={width} y1={i * 18} y2={i * 18} stroke="#ececec" />)}
          {points.length > 1 && <polyline fill="none" stroke="#1565ff" strokeWidth="1.5" points={points.map((p) => `${x(p.day)},${y(p.rank)}`).join(" ")} />}
          {points.map((p) => (
            <g key={p.day}>
              <circle cx={x(p.day)} cy={y(p.rank)} r="3" fill="#1565ff" />
              <text x={x(p.day)} y={y(p.rank) + (p.rank > total / 2 ? 12 : -6)} fontSize="7" textAnchor="middle" fill="#333">{p.rank}</text>
            </g>
          ))}
          {Array.from({ length: columns }, (_, i) => <text key={i} x={x(i + 1)} y={height + 22} fontSize="7" textAnchor="middle" fill="#777">J{i + 1}</text>)}
        </svg>
      </div>
    </section>
  );
}

export function PerformanceView({ data, basePath, query = {} }: { data: Performance; basePath: string; query?: Record<string, string | undefined> }) {
  const dayHref = (day: number) => `${basePath}?${new URLSearchParams({ ...(Object.fromEntries(Object.entries(query).filter(([, v]) => v)) as Record<string, string>), day: String(day) })}`;
  const index = data.days.indexOf(data.selectedDay);
  const prev = index > 0 ? data.days[index - 1] : null, next = index >= 0 && index < data.days.length - 1 ? data.days[index + 1] : null;
  return (
    <>
      <RankCards ranks={data.ranks} />
      <Evolution points={data.evolution} total={data.totalGamers} days={data.days.length} />

      <div className="gp-pair">
        <section className="gp-box gp-value" aria-label="Valeur de mon effectif">
          <h2 className="gp-head">Valeur de mon effectif {data.value.changePct !== 0 && <span className={`gp-badge ${data.value.changePct < 0 ? "is-down" : ""}`}>{Math.abs(data.value.changePct).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% {triangle(data.value.changePct < 0)}</span>}</h2>
          <p className="gp-big">{M(data.value.squad)}</p>
          <dl>
            <div><dt>Total Primes</dt><dd className={tone(data.value.primes) || "is-up"}>{sign(data.value.primes)}{money(Math.abs(data.value.primes))}</dd></div>
            <div><dt>Total Mercato</dt><dd className="is-blue">{sign(data.value.mercato)}{Math.abs(data.value.mercato) >= 1_000_000 ? M1(Math.abs(data.value.mercato)) : money(Math.abs(data.value.mercato))}</dd></div>
            <div><dt>Compte bloqué</dt><dd>{M(data.value.locked)}</dd></div>
          </dl>
        </section>

        <section className="gp-box gp-results" aria-label="Résultats">
          <h2 className="gp-head">Résultats
            <span className="gp-day">
              {prev !== null ? <Link href={dayHref(prev)} aria-label="Journée précédente">‹</Link> : <i>‹</i>}
              Journée {data.selectedDay}
              {next !== null ? <Link href={dayHref(next)} aria-label="Journée suivante">›</Link> : <i>›</i>}
            </span>
          </h2>
          <dl>
            <div><dt>Primes Titulaires</dt><dd className={tone(data.results.starters) || "is-up"}>{money(data.results.starters)}</dd></div>
            <div><dt>Primes Banc de touche</dt><dd className={tone(data.results.bench) || "is-up"}>{money(data.results.bench)}</dd></div>
            <div><dt>Pronostics</dt><dd className={tone(data.results.predictions) || "is-up"}>{money(data.results.predictions)}</dd></div>
            <div className="is-total"><dt>Total</dt><dd className={tone(data.results.total) || "is-up"}>{money(data.results.total)}</dd></div>
          </dl>
        </section>
      </div>

      <HistoryTable rows={data.history} />
    </>
  );
}
