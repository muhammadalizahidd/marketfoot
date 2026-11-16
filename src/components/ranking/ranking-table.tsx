import Link from "next/link";

import { clubCode } from "@/lib/club-codes";
import { getJerseyImage } from "@/lib/jersey-map";
import type { RankingMetric, RankingTableRow } from "@/data/repositories/ranking-table-repository";

const M = (value: number) => `${(value / 1_000_000).toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} M€`;
/** Amounts of a million or more in M€ (3 decimals), smaller ones in k€. */
export const money = (value: number) => (Math.abs(value) >= 1_000_000 ? M(value) : `${Math.round(value / 1000).toLocaleString("fr-FR")} k€`);
const int = (value: number) => Math.round(value).toLocaleString("fr-FR");

type Column = { key: string; label: string; render: (row: RankingTableRow) => string };

const squad: Column = { key: "squad_value", label: "Valeur effectif", render: (row) => M(row.squadValue) };
export const columnsFor: Record<RankingMetric, Column[]> = {
  general: [squad, { key: "budget", label: "Budget", render: (row) => money(row.budget) }, { key: "honours_points", label: "Palmarès", render: (row) => int(row.honoursPoints) }],
  primes: [squad, { key: "primes", label: "Primes", render: (row) => money(row.primes) }, { key: "latest_primes", label: "Dernières primes", render: (row) => money(row.latestPrimes) }],
  predictions: [squad, { key: "predictions", label: "Pronostics", render: (row) => money(row.predictions) }, { key: "latest_predictions", label: "Derniers pronostics", render: (row) => money(row.latestPredictions) }],
  speculation: [squad, { key: "speculation", label: "Spéculation", render: (row) => money(row.speculation) }, { key: "transfer_count", label: "Transferts", render: (row) => int(row.transferCount) }],
  bench: [squad, { key: "bench_primes", label: "Primes du banc", render: (row) => money(row.benchPrimes) }, { key: "latest_bench", label: "Dernières primes banc", render: (row) => money(row.latestBench) }],
  honours: [
    { key: "honours_points", label: "Points palmarès", render: (row) => int(row.honoursPoints) },
    { key: "best_rank", label: "Meilleur classement", render: (row) => (row.bestRank ? `${row.bestRank}${row.bestRank === 1 ? "er" : "e"}` : "—") },
    { key: "top10", label: "TOP 10", render: (row) => int(row.top10) },
    { key: "top20", label: "TOP 20", render: (row) => int(row.top20) },
    { key: "top30", label: "TOP 30", render: (row) => int(row.top30) },
  ],
};

const caret = <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 4.5 3 3 3-3" /></svg>;

export function RankingTable({ metric, rows, meId, sort, dir, sortHref }: { metric: RankingMetric; rows: RankingTableRow[]; meId: string; sort: string; dir: "asc" | "desc"; sortHref: (key: string, nextDir: "asc" | "desc") => string }) {
  const columns = columnsFor[metric];
  const template = `64px minmax(150px, 1.5fr) 110px repeat(${columns.length}, minmax(80px, 1fr))`;
  const head = (key: string, label: string) => (
    <Link key={key} href={sortHref(key, sort === key && dir === "asc" ? "desc" : "asc")} aria-sort={sort === key ? (dir === "asc" ? "ascending" : "descending") : undefined}>{label}{caret}</Link>
  );
  return (
    <section className="rk-table" aria-label="Classement">
      <div className="rk-row rk-head" style={{ gridTemplateColumns: template }}>
        {head("rank", "Rang")}{head("username", "Nom")}{head("club", "Club préféré")}
        {columns.map((column) => head(column.key, column.label))}
      </div>
      {rows.map((row) => (
        <div key={row.gamerId} className={`rk-row rk-body${row.gamerId === meId ? " is-me" : ""}`} style={{ gridTemplateColumns: template }}>
          <span className="rk-rank">{row.rank}{row.delta ? <i className={row.delta > 0 ? "is-up" : "is-down"}>{row.delta > 0 ? "▲" : "▼"} {Math.abs(row.delta)}</i> : null}</span>
          <Link href={`/profil/${row.gamerId}`} className="rk-name" title={row.username}>
            {row.avatarUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={row.avatarUrl} alt="" width={22} height={22} /> : <b aria-hidden="true">{row.username.slice(0, 1).toUpperCase()}</b>}
            <span>{row.username}</span>
          </Link>
          <span className="rk-club">{row.clubName ? <>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={getJerseyImage(row.clubName)} alt="" width={16} height={16} /><em>{clubCode(row.clubName)}</em></> : "—"}</span>
          {columns.map((column) => <span key={column.key}>{column.render(row)}</span>)}
        </div>
      ))}
    </section>
  );
}
