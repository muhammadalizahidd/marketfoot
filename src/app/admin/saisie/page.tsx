import Link from "next/link";
import { X } from "lucide-react";

import { ActionForm, ConfirmAction, Modal } from "@/components/admin/client";
import { Card, Chip, PageHeader } from "@/components/admin/ui";
import { formatDateTime, toDateInput, toTimeInput } from "@/lib/admin/format";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { deleteResource } from "@/features/admin/resource-actions";
import { postponeMatch, publishMatchday, saveMatchday } from "@/features/admin/saisie-actions";
import { ensureRulesSettings } from "@/services/rules-settings";
import type { RulesSettings } from "@/rules/settings";

const LIVE_WINDOW_MS = 2 * 60 * 60 * 1000;
type MatchState = "upcoming" | "live" | "finished";
const stateOf = (kickoff: string, now: number): MatchState => { const t = new Date(kickoff).getTime(); return now < t ? "upcoming" : now < t + LIVE_WINDOW_MS ? "live" : "finished"; };

/** Next occurrence of `weekday` strictly after the Paris calendar date of `after`, as YYYY-MM-DD. */
function nextWeekday(after: string | Date, weekday: number): string {
  const base = new Date(`${toDateInput(after)}T12:00:00Z`);
  const delta = ((weekday - base.getUTCDay() + 7) % 7) || 7;
  return new Date(base.getTime() + delta * 86_400_000).toISOString().slice(0, 10);
}

export default async function SaisiePage({ searchParams }: { searchParams: Promise<{ season?: string; day?: string }> }) {
  const query = await searchParams;
  const db = createSupabaseAdminClient();
  const [{ settings }, { data: seasons }] = await Promise.all([ensureRulesSettings(), db.from("seasons").select("id,name,status,starts_on").order("starts_on", { ascending: false })]);
  const season = seasons?.find((s) => s.id === query.season) ?? seasons?.find((s) => s.status === "active") ?? seasons?.[0];
  if (!season) return <main><PageHeader title="Saisie" /><p className="ad-empty">Créez d’abord une saison.</p></main>;

  const [{ data: days }, { data: links }, { data: allClubs }] = await Promise.all([
    db.from("matchdays").select("id,number,status,mercato_opens_at,mercato_closes_at,thaw_at,mercato_stage").eq("season_id", season.id).order("number"),
    db.from("season_clubs").select("club_id").eq("season_id", season.id),
    db.from("clubs").select("id,name,short_name").order("name"),
  ]);
  const dayIds = (days ?? []).map((d) => d.id);
  const { data: matches } = dayIds.length ? await db.from("matches").select("id,matchday_id,home_club_id,away_club_id,kickoff_at,home_score,away_score,is_postponed,sheet_status").in("matchday_id", dayIds).order("kickoff_at") : { data: [] };
  const now = Date.now();
  const dayState = (dayId?: string): "todo" | "done" | "idle" => {
    const list = (matches ?? []).filter((m) => m.matchday_id === dayId && !m.is_postponed);
    if (!list.length) return "idle";
    const states = list.map((m) => stateOf(m.kickoff_at, now));
    return states.every((s) => s === "finished") ? "todo" : states.some((s) => s !== "upcoming") ? "done" : "idle";
  };
  const byNumber = new Map((days ?? []).map((d) => [d.number, d]));
  const firstOpen = [...(days ?? [])].find((d) => dayState(d.id) !== "todo" && (matches ?? []).some((m) => m.matchday_id === d.id));
  const number = Math.min(40, Math.max(1, Number(query.day) || firstOpen?.number || (days ?? []).at(-1)?.number || 1));
  const day = byNumber.get(number);
  const dayMatches = (matches ?? []).filter((m) => m.matchday_id === day?.id);
  const clubIds = new Set((links ?? []).map((l) => l.club_id));
  const clubs = (allClubs ?? []).filter((c) => !clubIds.size || clubIds.has(c.id));
  const rowCount = Math.max(dayMatches.length, Math.floor(clubs.length / 2) || 9);
  const lastKickoff = dayMatches.at(-1)?.kickoff_at ?? new Date().toISOString();
  const schedule = (settings as RulesSettings).schedule;
  const dflt = (stored: string | null, key: "mercatoOpen" | "mercatoClose" | "thaw") => stored ? { date: toDateInput(stored), time: toTimeInput(stored) } : { date: dayMatches.length ? nextWeekday(lastKickoff, schedule[key].day) : "", time: schedule[key].time };
  const open = dflt(day?.mercato_opens_at ?? null, "mercatoOpen");
  const close = dflt(day?.mercato_closes_at ?? null, "mercatoClose");
  const thaw = dflt(day?.thaw_at ?? null, "thaw");
  const hrefDay = (n: number) => `/admin/saisie?season=${season.id}&day=${n}`;
  const publishLabel = !day || day.status === "draft" ? "Publier" : day.status === "closed" ? "Publier (règlement)" : day.status === "settled" ? "Publiée" : "Publier";
  const publishable = !day ? false : day.status === "draft" || day.status === "closed";
  const clubOptions = <>{clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</>;

  return (
    <main>
      <PageHeader title={<>Saisie <span className="ad-muted" style={{ fontSize: 15, fontWeight: 400 }}>{season.name}{day ? ` · J${number}` : ""}</span></>}
        actions={<>
          {(seasons?.length ?? 0) > 1 && <form method="get"><select className="ad-select" name="season" defaultValue={season.id} aria-label="Saison" style={{ minWidth: 200 }}>{seasons!.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select><button className="ad-btn ad-btn--ghost" style={{ marginLeft: 8 }} type="submit">Afficher</button></form>}
          <Link className="ad-btn ad-btn--ghost" href="/admin/saisie/publication">Règlements</Link>
        </>} />

      <div className="ad-saisie">
        <Card title="Journées" flush>
          <div className="ad-days">
            {Array.from({ length: 34 }, (_, i) => i + 1).map((n) => {
              const state = dayState(byNumber.get(n)?.id);
              return <Link key={n} href={hrefDay(n)} className={`ad-day${state === "todo" ? " ad-day--todo" : state === "done" ? " ad-day--done" : ""}${n === number ? " ad-day--active" : ""}`} aria-current={n === number ? "page" : undefined}>J{n}</Link>;
            })}
          </div>
        </Card>

        <Card title={<>Matchs {day && <Chip tone={day.status === "settled" ? "ok" : day.status === "draft" ? "off" : "info"}>{day.status}</Chip>}</>} flush>
          <div className="ad-stack" style={{ gap: 10, padding: "12px 0" }}>
            {Array.from({ length: rowCount }, (_, i) => {
              const match = dayMatches[i];
              const state = match ? stateOf(match.kickoff_at, now) : "upcoming";
              const f = (name: string) => `row.${i}.${name}`;
              return (
                <div className="ad-match" key={match?.id ?? `new-${i}`}>
                  <span className="ad-match-n">{i + 1}</span>
                  <span className={`ad-dot${match && state === "finished" ? " ad-dot--todo" : match && state === "live" ? " ad-dot--done" : ""}`} title={state === "finished" ? "Terminé" : state === "live" ? "En cours" : "À venir"} />
                  <input type="hidden" form="saisie-form" name={f("id")} value={match?.id ?? ""} />
                  <input className="ad-input" form="saisie-form" type="date" name={f("date")} defaultValue={match ? toDateInput(match.kickoff_at) : ""} aria-label={`Date du match ${i + 1}`} />
                  <input className="ad-input" form="saisie-form" type="time" name={f("time")} defaultValue={match ? toTimeInput(match.kickoff_at) : ""} aria-label={`Heure du match ${i + 1}`} />
                  <select className="ad-select" form="saisie-form" name={f("home")} defaultValue={match?.home_club_id ?? ""} aria-label={`Équipe domicile ${i + 1}`}><option value="">Équipe domicile</option>{clubOptions}</select>
                  <select className="ad-select" form="saisie-form" name={f("away")} defaultValue={match?.away_club_id ?? ""} aria-label={`Équipe extérieure ${i + 1}`}><option value="">Équipe extérieure</option>{clubOptions}</select>
                  <div className="ad-match-actions">
                    {match?.sheet_status === "validated" ? <Link className="ad-btn ad-btn--sm" style={{ background: "#1fc050", borderColor: "#1fc050" }} href={`/admin/saisie/${number}/${match.id}`}>Validé</Link>
                      : match && state !== "upcoming" ? <Link className="ad-btn ad-btn--sm" href={`/admin/saisie/${number}/${match.id}`}>Saisir</Link>
                      : <span className="ad-btn ad-btn--sm" aria-disabled="true" style={{ opacity: .35 }}>Saisir</span>}
                    {match ? (
                      <>
                        <Modal size="sm" triggerClassName="ad-btn ad-btn--sm" trigger="Reporter" title="Reporter le match">
                          <ActionForm action={postponeMatch} submitLabel="Reporter" toast>
                            <input type="hidden" name="matchId" value={match.id} />
                            <p className="ad-muted">Le match sera exclu des pronostics et du règlement. Indiquez sa nouvelle date si elle est connue.</p>
                            <div className="ad-form-row"><label className="ad-field"><span>Nouvelle date</span><input className="ad-input" type="date" name="date" /></label><label className="ad-field"><span>Heure</span><input className="ad-input" type="time" name="time" /></label></div>
                          </ActionForm>
                        </Modal>
                        <ConfirmAction action={deleteResource} fields={{ resource: "matches", id: match.id, confirmation: "delete" }} label={<X size={14} aria-label="Supprimer le match" />} message="Supprimer ce match ? Impossible s’il a une feuille de match." confirmLabel="Supprimer" />
                      </>
                    ) : <span className="ad-btn ad-btn--sm" aria-disabled="true" style={{ opacity: .35 }}>Reporter</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="Déroulé" flush>
          <div className="ad-side-form">
            <label className="ad-field"><span>Gel avant le coup d’envoi</span><input className="ad-input" value={`${(settings as RulesSettings).freeze.hoursBeforeKickoff} h`} disabled aria-label="Gel avant le coup d’envoi" /></label>
            {([["mercato_open", "Ouverture du mercato", open], ["mercato_close", "Fermeture du mercato", close], ["thaw", "Dégel du site", thaw]] as const).map(([name, label, value]) => (
              <div key={name} className="ad-field"><span>{label}</span>
                <input className="ad-input" form="saisie-form" type="date" name={`${name}_date`} defaultValue={value.date} aria-label={`${label} — date`} />
                <input className="ad-input" form="saisie-form" type="time" name={`${name}_time`} defaultValue={value.time} aria-label={`${label} — heure`} />
              </div>
            ))}
            {day?.mercato_opens_at && <p className="ad-muted" style={{ fontSize: 12 }}>Mercato prévu le {formatDateTime(day.mercato_opens_at)}.</p>}
          </div>
        </Card>
      </div>

      <div className="ad-form-actions" style={{ marginTop: 20, alignItems: "center" }}>
        <ActionForm id="saisie-form" action={saveMatchday} className="ad-inline-form" submitLabel="Enregistrer" submitClassName="ad-btn ad-btn--outline">
          <input type="hidden" name="seasonId" value={season.id} />
          <input type="hidden" name="number" value={number} />
        </ActionForm>
        {day ? <ConfirmAction action={publishMatchday} fields={{ matchdayId: day.id }} small={false} variant="primary" disabled={!publishable} label={publishLabel}
          message={day.status === "draft" ? `Publier la journée ${number} ? Les managers pourront composer leur équipe.` : `Préparer le règlement de la journée ${number} ? Vous le relirez avant de le comptabiliser.`} confirmLabel="Publier" />
          : <span className="ad-btn" aria-disabled="true" style={{ opacity: .45 }}>Publier</span>}
      </div>
    </main>
  );
}
