import Link from "next/link";

import { clubCode } from "@/lib/club-codes";
import { getJerseyImage } from "@/lib/jersey-map";
import type { FriendPeriod, FriendRow } from "@/data/repositories/gamer-repository";
import { removeFriend } from "./actions";
import { AddFriend } from "./add-friend";

const M = (value: number) => `${(value / 1_000_000).toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} M€`;
const money = (value: number) => (Math.abs(value) >= 1_000_000 ? M(value) : `${Math.round(value / 1000).toLocaleString("fr-FR")} k€`);
const caret = <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 4.5 3 3 3-3" /></svg>;
const trash = <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4zM6 9h12l-1 12H7z" /></svg>;

const periods: [FriendPeriod, string][] = [["all", "Général"], ["first", "Phase aller"], ["second", "Phase retour"], ["day", "Journée"]];
const columns: [string, string][] = [["rank", "Rang"], ["username", "Nom"], ["club", "Club préféré"], ["squadValue", "Valeur effectif"], ["budget", "Budget"], ["primes", "Primes"], ["latestPrimes", "Dernières primes"], ["honours", "Palmarès"]];

export function FriendsView({ rows, period, sort, dir, basePath, day }: { rows: FriendRow[]; period: FriendPeriod; sort?: string; dir: "asc" | "desc"; basePath: string; day: number }) {
  const href = (changes: Record<string, string | undefined>) => {
    const params = new URLSearchParams({ tab: "amis", ...(period !== "all" ? { period } : {}), ...(sort ? { sort, dir } : {}), ...(period === "day" ? { day: String(day) } : {}) });
    for (const [key, value] of Object.entries(changes)) { if (value === undefined) params.delete(key); else params.set(key, value); }
    return `${basePath}?${params}`;
  };
  return (
    <>
      <div className="gp-friends-top">
        <nav className="pl-sub" aria-label="Période">
          {periods.map(([id, label]) => <Link key={id} href={href({ period: id === "all" ? undefined : id })} className={period === id ? "is-active" : undefined}>{label}</Link>)}
        </nav>
        <AddFriend />
      </div>
      <section className="gp-ftable" aria-label="Amis">
        <div className="gp-frow gp-fhead">
          {columns.map(([key, label]) => key === "club" ? <span key={key}>{label}{caret}</span> : <Link key={key} href={href({ sort: key, dir: sort === key && dir === "asc" ? "desc" : "asc" })}>{label}{caret}</Link>)}
          <span aria-hidden="true" />
        </div>
        {rows.length ? rows.map((row) => (
          <div key={row.gamerId} className={`gp-frow gp-fbody${row.isMe ? " is-me" : ""}`}>
            <span className="rk">{row.rank}{row.delta ? <i className={row.delta > 0 ? "is-up" : "is-down"}>{row.delta > 0 ? "▲" : "▼"} {Math.abs(row.delta)}</i> : null}</span>
            <Link href={`/profil/${row.gamerId}`} className="nm">
              {row.avatarUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={row.avatarUrl} alt="" width={22} height={22} /> : <b>{row.username.slice(0, 1).toUpperCase()}</b>}
              {row.username}
            </Link>
            <span className="cl">{row.club ? <>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={getJerseyImage(row.club.name)} alt="" width={16} height={16} /><em>{clubCode(row.club.name)}</em></> : "—"}</span>
            <span>{M(row.squadValue)}</span><span>{money(row.budget)}</span><span>{M(row.primes)}</span><span>{money(row.latestPrimes)}</span><span>{row.honours}</span>
            <span className="del">{row.isMe ? null : <form action={removeFriend}><input type="hidden" name="friendId" value={row.gamerId} /><button type="submit" aria-label={`Retirer ${row.username} de mes amis`}>{trash}</button></form>}</span>
          </div>
        )) : <p className="gp-none">Aucun ami pour le moment : ajoutez un manager avec son pseudo.</p>}
      </section>
    </>
  );
}
