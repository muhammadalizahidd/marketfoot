import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type Tone = "ok" | "warn" | "bad" | "info" | "off";

export function Chip({ tone = "off", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`ad-chip${tone === "off" ? "" : ` ad-chip--${tone}`}`}>{children}</span>;
}

export function PageHeader({ title, actions }: { title: ReactNode; actions?: ReactNode }) {
  return <header className="ad-head"><h1>{title}</h1>{actions && <div className="ad-head-actions">{actions}</div>}</header>;
}

export function Crumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav className="ad-crumbs" aria-label="Fil d’Ariane">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} style={{ display: "contents" }}>
          {index > 0 && <span aria-hidden="true">/</span>}
          {item.href ? <Link href={item.href}>{item.label}</Link> : <span>{item.label}</span>}
        </span>
      ))}
    </nav>
  );
}

export function Card({ title, actions, children, className = "", flush = false }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; flush?: boolean }) {
  return (
    <section className={`ad-card ${className}`}>
      {title && <header className="ad-card-head"><span>{title}</span>{actions}</header>}
      {flush ? children : <div className="ad-card-body">{children}</div>}
    </section>
  );
}

export function Kpi({ label, value }: { label: string; value: ReactNode }) {
  return <div className="ad-kpi"><small>{label}</small><b>{value}</b></div>;
}

export function PillTabs({ tabs, active }: { tabs: { id: string; label: string; href: string }[]; active: string }) {
  return (
    <nav className="ad-tabs" aria-label="Sections">
      {tabs.map((tab) => <Link key={tab.id} href={tab.href} aria-current={tab.id === active ? "page" : undefined}>{tab.label}</Link>)}
    </nav>
  );
}

export function PositionBadge({ position }: { position: string }) {
  const label = position === "GK" ? "G" : position === "DF" ? "D" : position === "MF" ? "M" : "A";
  return <span className={`ad-pos ad-pos--${position}`} title={position}>{label}</span>;
}

/** Numeric input used by the Barèmes grids. `name` is a dotted settings path (see baremes-actions). */
export function NumberField({ name, defaultValue, label, disabled, step = "any", suffix, hint, hideLabel }: { name: string; defaultValue: number | string; label?: string; disabled?: boolean; step?: string; suffix?: string; hint?: string; hideLabel?: boolean }) {
  return (
    <label className="ad-field" title={hint}>
      {label && !hideLabel && <span>{label}</span>}
      <span className="ad-num"><input type="number" name={name} defaultValue={defaultValue} step={step} disabled={disabled} aria-label={label ?? name} required />{suffix && <em style={{ position: "absolute", right: 12, top: 12, fontStyle: "normal", color: "#6b6f76" }}>{suffix}</em>}</span>
    </label>
  );
}

export function PhaseStepper({ steps, active, doneBefore = true }: { steps: { id: string; label: string; when?: string }[]; active: string; doneBefore?: boolean }) {
  const activeIndex = steps.findIndex((step) => step.id === active);
  return (
    <ol className="ad-stepper" style={{ ["--steps" as string]: steps.length, listStyle: "none", margin: 0, padding: 0 }}>
      {steps.map((step, index) => (
        <li key={step.id} className={`ad-step${index === activeIndex ? " is-active" : doneBefore && index < activeIndex ? " is-done" : ""}`} aria-current={index === activeIndex ? "step" : undefined}>
          <small>{step.when ?? " "}</small>
          <span>{step.label}</span>
        </li>
      ))}
    </ol>
  );
}

/** "10 résultats par page · 1-10 de 200 résultats … 1 sur 44 pages ‹ ›" footer. */
export function TableFooter({ page, perPage, total, hrefFor }: { page: number; perPage: number; total: number; hrefFor: (page: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(total, page * perPage);
  return (
    <footer className="ad-table-foot">
      <span>{perPage} résultats par page · {from}-{to} de {total} résultats</span>
      <span className="ad-pager">
        <span>{page} sur {pages} pages</span>
        {page > 1 ? <Link href={hrefFor(page - 1)} aria-label="Page précédente"><ChevronLeft size={16} /></Link> : <span className="is-off"><ChevronLeft size={16} /></span>}
        {page < pages ? <Link href={hrefFor(page + 1)} aria-label="Page suivante"><ChevronRight size={16} /></Link> : <span className="is-off"><ChevronRight size={16} /></span>}
      </span>
    </footer>
  );
}

/** Reads `?page=` as a safe positive integer. */
export function pageParam(value: string | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

/** Builds `/path?a=1&b=2` from a params object, dropping empty values. */
export function href(path: string, params: Record<string, string | number | undefined | null>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  const text = query.toString();
  return text ? `${path}?${text}` : path;
}
