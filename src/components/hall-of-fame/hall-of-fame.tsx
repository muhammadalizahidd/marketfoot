import Link from "next/link";
import type { ReactNode } from "react";

import { AppHeader } from "@/components/layout/app-header";

export type HofRecord = { rank: number; name: string; period: string; amount: number; /** Overrides the formatted amount (e.g. "18 achats"). */ label?: string; avatar?: string; isMe?: boolean };
export type HofGroup = "managers" | "joueurs";
export type HofCategory = "perfs" | "banc" | "mercato" | "achats" | "ventes";
export type HofScope = "day" | "season";

const svg = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
const icons: Record<string, ReactNode> = {
  person: <svg {...svg}><circle cx="12" cy="7" r="4" /><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" /></svg>,
  money: <svg {...svg}><path d="M9 3h6l-1.6 3.4C17 8 20 11.5 20 15.5 20 19 17 21 12 21s-8-2-8-5.5C4 11.5 7 8 10.6 6.4z" /><circle cx="12" cy="15" r="1.6" /></svg>,
  bench: <svg {...svg} strokeWidth="2.4"><path d="M4 11h16" /><path d="M6 11v6M18 11v6" /><path d="M5 14h14" /></svg>,
  exchange: <svg {...svg}><path d="M4 8h14M14 4l4 4-4 4" /><path d="M20 16H6M10 12l-4 4 4 4" /></svg>,
  jersey: <svg {...svg}><path d="M8 3 3 6l2 4 3-1v12h8V9l3 1 2-4-5-3c-.6 1.3-2 2-4 2S8.6 4.3 8 3z" /></svg>,
  basket: <svg {...svg}><path d="M3 10h18l-2 10H5z" /><path d="M8 10l3-6M16 10l-3-6" /><path d="m9.5 15 2 2 3.5-3.5" /></svg>,
  tag: <svg {...svg}><path d="M3 12V4h8l10 10-8 8z" /><circle cx="8" cy="9" r="1.2" /></svg>,
};

type Item = { id: HofCategory; icon: string; title: string; text: string };
const managers: Item[] = [
  { id: "perfs", icon: "money", title: "Perfs", text: "Primes des titulaires" },
  { id: "banc", icon: "bench", title: "Banc", text: "Primes des remplaçants" },
  { id: "mercato", icon: "exchange", title: "Mercato", text: "Plus-value en achat/vente" },
];
const players: Item[] = [
  { id: "perfs", icon: "money", title: "Perfs", text: "Primes des joueurs de L1" },
  { id: "achats", icon: "basket", title: "Achats", text: "Les + achetés au mercato" },
  { id: "ventes", icon: "tag", title: "Ventes", text: "Les + vendus au mercato" },
];

export const hofCopy: Record<HofGroup, Partial<Record<HofCategory, { heading: string; text: string }>>> = {
  managers: {
    perfs: { heading: "Record de gains", text: "Manager qui a remporté le + de gains grâce à ses titulaires" },
    banc: { heading: "Record du banc", text: "Manager qui a remporté le + de primes grâce à ses remplaçants" },
    mercato: { heading: "Record de mercato", text: "Manager qui a réalisé la + grosse plus-value en achat/vente" },
  },
  joueurs: {
    perfs: { heading: "Record de perfs", text: "Joueur de L1 qui a rapporté le + de primes à ses détenteurs" },
    achats: { heading: "Record d’achats", text: "Joueur le + acheté au mercato" },
    ventes: { heading: "Record de ventes", text: "Joueur le + vendu au mercato" },
  },
};

const money = (value: number) => `${(value / 1_000_000).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} M€`;
const avatarOf = (record: { avatar?: string }) => record.avatar ?? "/images/hof/avatar-default.png";

export function hofHref(values: { group?: HofGroup; category?: HofCategory; scope?: HofScope }) {
  const params = new URLSearchParams();
  if (values.group && values.group !== "managers") params.set("group", values.group);
  if (values.category && values.category !== "perfs") params.set("category", values.category);
  if (values.scope && values.scope !== "day") params.set("scope", values.scope);
  const text = params.toString();
  return `/hall-of-fame${text ? `?${text}` : ""}`;
}

type Props = {
  group: HofGroup;
  category: HofCategory;
  scope: HofScope;
  records: HofRecord[];
  heading?: string;
  text?: string;
  emptyText?: string;
};

function Podium({ records }: { records: HofRecord[] }) {
  const medal = [
    { place: 2, cls: "silver", record: records.find((r) => r.rank === 2) },
    { place: 1, cls: "gold", record: records.find((r) => r.rank === 1) },
    { place: 3, cls: "bronze", record: records.find((r) => r.rank === 3) },
  ];
  return (
    <div className="hof-podium">
      {medal.map(({ cls, record, place }) => record && (
        <article key={cls} className={`hof-medal hof-medal--${cls}`}>
          <div className="hof-medal-top"><span className="hof-place">{place}<sup>{place === 1 ? "er" : "e"}</sup></span></div>
          <div className="hof-medal-body" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="hof-medal-avatar" src={record.avatar ?? `/images/hof/avatar-${place}.png`} alt="" width={124} height={124} />
          <div className="hof-medal-who">
            <strong>{record.name}</strong>
            <span>{record.period}</span>
          </div>
          <b className="hof-amount">{record.label ?? money(record.amount)}</b>
        </article>
      ))}
    </div>
  );
}

function Row({ record, me }: { record: HofRecord; me?: boolean }) {
  return (
    <li className={me ? "is-me" : undefined}>
      <span className="rk">{record.rank}</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={avatarOf(record)} alt="" width={32} height={32} />
      <span className="who"><b>{record.name}</b><small>{record.period}</small></span>
      <span className="vl">{record.label ?? money(record.amount)}</span>
    </li>
  );
}

function Group({ id, label, icon, items, group, category, scope }: { id: HofGroup; label: string; icon: string; items: Item[] } & Pick<Props, "group" | "category" | "scope">) {
  return (
    <section className={`hof-group hof-group--${id}`}>
      <div className="hof-group-head"><span className="hof-tile">{icons[icon]}</span><h2>{label}</h2><i /></div>
      <div className="hof-cards">
        {items.map((item) => {
          const active = group === id && category === item.id;
          return (
            <Link key={item.id} href={hofHref({ group: id, category: item.id, scope })} className={`hof-card${active ? " is-active" : ""}`} aria-current={active ? "page" : undefined}>
              <span className="hof-tile">{icons[item.icon]}</span>
              <span className="hof-card-text"><b>{item.title}</b><span>{item.text}</span></span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export function HallOfFame({ group, category, scope, records, heading, text, emptyText }: Props) {
  const copy = hofCopy[group][category] ?? { heading: "Record", text: "" };
  const podium = records.filter((record) => record.rank <= 3);
  const list = records.filter((record) => record.rank > 3 && record.rank <= 10);
  const me = records.find((record) => record.isMe && record.rank > 10);
  const nav = { group, category, scope };
  return (
    <div className="hof">
      <div className="hof-frame">
        <AppHeader />
        <div className="hof-groups">
          <Group id="managers" label="Managers" icon="person" items={managers} {...nav} />
          <Group id="joueurs" label="Joueurs" icon="jersey" items={players} {...nav} />
        </div>

        <div className="hof-intro">
          <h1>{heading ?? copy.heading}</h1>
          <p>{text ?? copy.text}</p>
          <div className="hof-toggle" role="group" aria-label="Période">
            <Link href={hofHref({ group, category, scope: "day" })} className={scope === "day" ? "is-active" : undefined}>Par journée</Link>
            <Link href={hofHref({ group, category, scope: "season" })} className={scope === "season" ? "is-active" : undefined}>Par saison</Link>
          </div>
        </div>

        {podium.length ? <Podium records={podium} /> : <p className="hof-empty">{emptyText ?? "Aucun record enregistré pour le moment."}</p>}

        <aside className="hof-ranking" aria-label="Classement">
          <header><h2>Classement</h2><span>4e-10e</span></header>
          <ol>
            {list.map((record) => <Row key={`${record.rank}-${record.name}`} record={record} me={record.isMe} />)}
            {me && <Row record={me} me />}
          </ol>
        </aside>
      </div>
    </div>
  );
}
