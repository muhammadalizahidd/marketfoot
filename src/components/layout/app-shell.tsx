import Link from "next/link";
import type { ReactNode } from "react";

import { signOut } from "@/features/auth/actions";
import { AppHeader } from "./app-header";
import { clubCode } from "@/lib/club-codes";
import { getJerseyImage } from "@/lib/jersey-map";
import type { TopMover } from "@/data/repositories/players-repository";

export type SidebarRankingRow = { rank: number; username: string; wealth: number; isMe: boolean };

const eur = (value: number, digits = 2) => `${value.toLocaleString("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits })} M€`;
const millions = (value: number) => eur(value / 1_000_000);
const millionsTrim = (value: number) => `${(value / 1_000_000).toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} M€`;

type AppShellProps = {
  children: ReactNode;
  username: string;
  budget: number;
  lockedAccount: number;
  rank?: number;
  wealth?: number;
  leaderboard?: SidebarRankingRow[];
  topBuys?: TopMover[];
  topSells?: TopMover[];
  avatarUrl?: string | null;
  userId?: string;
};

const kilo = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(Math.round(value / 1000)).toLocaleString("fr-FR")} k€`;

function Movers({ items, tone }: { items: TopMover[]; tone: "up" | "down" }) {
  return (
    <ol className="ms-rows">
      {items.map((item, index) => (
        <li key={item.id} className="ms-row ms-row--mover">
          <span className="rk">{index + 1}</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="ms-jersey" src={getJerseyImage(item.clubName)} alt="" width={16} height={16} />
          <span className="cl">{clubCode(item.clubName)}</span>
          <span className="nm">{item.name}</span>
          <span className={`vl ${tone}`}>{item.delta ? `${kilo(item.delta)} (${item.count})` : `(${item.count})`}</span>
        </li>
      ))}
    </ol>
  );
}

export function AppShell({ children, username, budget, wealth, leaderboard = [], topBuys = [], topSells = [], avatarUrl, userId }: AppShellProps) {
  return (
    <div className="ms-shell">
      <AppHeader />

      <div className="ms-body">
        <aside className="ms-sidebar" aria-label="Mon espace">
          <section className="ms-account">
            <div className="ms-account-photo" aria-hidden="true">{avatarUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={avatarUrl} alt="" /> : username.slice(0, 1).toUpperCase()}</div>
            <div className="ms-account-body">
              <div className="ms-account-top">
                <Link href={userId ? `/profil/${userId}` : "/profil"} className="ms-account-name">{username}</Link>
                <Link href="/mon-espace" aria-label="Paramètres">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
                </Link>
                <form action={signOut} style={{ display: "contents" }}>
                  <button type="submit" aria-label="Se déconnecter" title="Se déconnecter">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                  </button>
                </form>
              </div>
              <span className="ms-account-label">Mon effectif :</span>
              <div className="ms-account-value">
                <span>{wealth !== undefined ? millions(wealth - budget) : "—"}</span>
                <span className="ms-ball" aria-hidden="true" />
              </div>
              <div className="ms-account-budget"><span>Budget :</span><b>{millionsTrim(budget)}</b></div>
            </div>
          </section>

          <section className="ms-card">
            <div className="ms-card-head">Classement général <Link href="/classements">Tout voir</Link></div>
            {leaderboard.length ? (
              <ol className="ms-rows">
                {leaderboard.map((row) => (
                  <li key={`${row.rank}-${row.username}`} className={`ms-row${row.isMe ? " is-me" : ""}`}>
                    <span className="rk">{row.rank}</span>
                    <span className="dl" aria-hidden="true" />
                    <span className="nm">{row.username}</span>
                    <span className="vl">{millions(row.wealth)}</span>
                  </li>
                ))}
              </ol>
            ) : <p className="ms-empty">Le classement apparaîtra après le premier règlement.</p>}
          </section>

          <section className="ms-card">
            <div className="ms-card-head">Top Achats <Link href="/joueurs?view=speculation&period=today&sort=buys">Tout voir</Link></div>
            {topBuys.length ? <Movers items={topBuys} tone="up" /> : <p className="ms-empty">Les joueurs les plus achetés apparaîtront ici.</p>}
          </section>

          <section className="ms-card">
            <div className="ms-card-head">Top Ventes <Link href="/joueurs?view=speculation&period=today&sort=sells">Tout voir</Link></div>
            {topSells.length ? <Movers items={topSells} tone="down" /> : <p className="ms-empty">Les joueurs les plus vendus apparaîtront ici.</p>}
          </section>
        </aside>

        {children}
      </div>

      <footer className="ms-footer">
        <div className="ms-footer-in">
          <span>© MarketFoot</span>
          <span>
            <Link href="/hall-of-fame">Hall of Fame</Link>
            <Link href="/classements">Classements</Link>
            <Link href="/ligue-1">Ligue 1</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
