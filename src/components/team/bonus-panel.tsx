"use client";
import { useActionState, useRef } from "react";

import { bonusCatalogue } from "@/lib/bonus-catalogue";
import { playBonus } from "@/features/squad/bonus-actions";

export type BonusState = {
  matchdayId: string | null;
  chosen: string | null;
  /** Plays already used this season, per bonus. */
  used: Record<string, number>;
  /** Maximum per season, per bonus (Barèmes). */
  max: Record<string, number>;
  enabled: Record<string, boolean>;
  gainPct: number;
  /** True from 2 h before the first match of the matchday. */
  locked: boolean;
};

/** Right-hand Bonus panel of the composition screen (PRD §6.4): one bonus per matchday, +gain % of the starters' primes. */
export function BonusPanel({ state }: { state?: BonusState }) {
  const [result, action, pending] = useActionState(playBonus, {});
  const formRef = useRef<HTMLFormElement>(null);
  const bonusRef = useRef<HTMLInputElement>(null);
  const gain = state?.gainPct ?? 10;
  const choose = (id: string) => { if (!bonusRef.current) return; bonusRef.current.value = state?.chosen === id ? "" : id; formRef.current?.requestSubmit(); };

  return (
    <aside className="tm-panel tm-bonus" aria-label="Bonus">
      <header className="tm-panel-head">
        <h2>
          Bonus
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-label={`Aide : joue un bonus par journée, +${gain} % sur les primes de tes titulaires s’il se réalise.`}>
            <circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7" /><circle cx="12" cy="17" r=".6" fill="currentColor" />
          </svg>
        </h2>
        <span className="tm-badge">{gain}%</span>
      </header>
      <form ref={formRef} action={action}>
        <input type="hidden" name="matchdayId" value={state?.matchdayId ?? ""} />
        <input ref={bonusRef} type="hidden" name="bonusId" />
      </form>
      <ul className="tm-bonus-list">
        {bonusCatalogue.map((bonus) => {
          const used = state?.used[bonus.id] ?? 0;
          const max = state?.max[bonus.id] ?? 0;
          const chosen = state?.chosen === bonus.id;
          const exhausted = !chosen && used >= max;
          const off = state ? state.enabled[bonus.id] === false : false;
          const disabled = pending || !state?.matchdayId || state.locked || exhausted || off;
          const dim = disabled && !chosen;
          return (
            <li key={bonus.id}>
              <button type="button" className={`tm-bonus-item${chosen ? " is-chosen" : ""}`} onClick={() => choose(bonus.id)} aria-pressed={chosen} disabled={dim} style={dim ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
                title={off ? "Bonus indisponible" : exhausted ? "Maximum atteint sur la saison" : state?.locked ? "Verrouillé 2 h avant le premier match" : undefined}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/images/bonus/${bonus.image}.png`} alt="" width={60} height={60} />
                <span className="tm-bonus-text">
                  <strong>{bonus.title}</strong>
                  <span>{bonus.text}</span>
                </span>
                <span className="tm-bonus-count">{used}/{max}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {(result.error || result.success) && <p className={`tm-alert ${result.error ? "tm-alert--error" : "tm-alert--success"}`} style={{ margin: 12 }} role={result.error ? "alert" : "status"}>{result.error ?? result.success}</p>}
    </aside>
  );
}
