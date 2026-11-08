import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { ActionForm } from "@/components/admin/client";
import { Card, Crumbs } from "@/components/admin/ui";
import { formatDate, toTimeInput } from "@/lib/admin/format";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { prefillMatchSheet } from "@/features/admin/saisie-actions";
import { MatchSheet, type SheetCandidate, type SheetRow } from "@/features/admin/match-sheet";
import { ensureRulesSettings } from "@/services/rules-settings";

export default async function MatchSheetPage({ params }: { params: Promise<{ day: string; match: string }> }) {
  const { day, match: matchId } = await params;
  if (!z.string().uuid().safeParse(matchId).success) notFound();
  const db = createSupabaseAdminClient();
  const [{ settings }, { data: match }] = await Promise.all([ensureRulesSettings(), db.from("matches").select("*").eq("id", matchId).maybeSingle()]);
  if (!match) notFound();
  const [{ data: matchday }, { data: strip }, { data: clubs }, { data: stats }, { data: roster }] = await Promise.all([
    db.from("matchdays").select("id,number,status").eq("id", match.matchday_id).single(),
    db.from("matches").select("id,kickoff_at,home_score,away_score,home_club_id,away_club_id").eq("matchday_id", match.matchday_id).order("kickoff_at"),
    db.from("clubs").select("id,name"),
    db.from("player_match_stats").select("player_id,started,minutes_played,goals,assists,penalties_scored,own_goals,penalties_missed,yellow_cards,red_cards,saves,stoppage_time_goals,players(first_name,last_name,position,club_id)").eq("match_id", matchId),
    db.from("players").select("id,first_name,last_name,position,club_id").eq("is_active", true).in("club_id", [match.home_club_id, match.away_club_id]),
  ]);
  if (!matchday) notFound();
  const name = new Map((clubs ?? []).map((club) => [club.id, club.name]));
  const home = { id: match.home_club_id, name: name.get(match.home_club_id) ?? "Domicile" };
  const away = { id: match.away_club_id, name: name.get(match.away_club_id) ?? "Extérieur" };
  const one = <T,>(value: T | T[] | null): T | null => (Array.isArray(value) ? value[0] ?? null : value);
  const rows: SheetRow[] = (stats ?? []).flatMap((row) => {
    const player = one(row.players);
    if (!player) return [];
    return [{ playerId: row.player_id, name: `${player.first_name?.[0] ? `${player.first_name[0]}. ` : ""}${player.last_name}`, position: player.position, clubId: player.club_id, started: row.started, minutes: row.minutes_played, goals: row.goals, assists: row.assists, penalties_scored: row.penalties_scored, own_goals: row.own_goals, penalties_missed: row.penalties_missed, yellow_cards: row.yellow_cards, red_cards: row.red_cards, saves: row.saves, stoppage_time_goals: row.stoppage_time_goals }];
  });
  const candidates: SheetCandidate[] = (roster ?? []).map((p) => ({ id: p.id, name: `${p.first_name} ${p.last_name}`.trim(), position: p.position, clubId: p.club_id }));
  const date = formatDate(match.kickoff_at);

  return (
    <main>
      <Crumbs items={[{ label: "⌂", href: "/admin" }, { label: "Saisie", href: "/admin/saisie" }, { label: `J${matchday.number}`, href: `/admin/saisie?day=${matchday.number}` }, { label: `${home.name}-${away.name}` }]} />
      <div className="ad-section"><Card flush>
        <div className="ad-match-strip">
          {(strip ?? []).map((item) => (
            <Link key={item.id} href={`/admin/saisie/${day}/${item.id}`} className={`ad-match-chip${item.id === matchId ? " is-active" : ""}`}>
              <small>{formatDate(item.kickoff_at).slice(0, 5)} {toTimeInput(item.kickoff_at)}</small>
              <b><span>{name.get(item.home_club_id)}</span><span>{item.home_score ?? ""}</span></b>
              <b><span>{name.get(item.away_club_id)}</span><span>{item.away_score ?? ""}</span></b>
            </Link>
          ))}
        </div>
      </Card></div>
      <div className="ad-section">
        <p className="ad-muted" style={{ marginBottom: 8 }}>{date} · {toTimeInput(match.kickoff_at)}{match.is_postponed ? " · reporté" : ""}</p>
        {matchday.status !== "settled" && (
          <div style={{ marginBottom: 12 }}>
            <ActionForm action={prefillMatchSheet} className="ad-inline-form" submitLabel="Pré-remplir avec les joueurs des deux clubs" submitClassName="ad-btn ad-btn--ghost ad-btn--sm"><input type="hidden" name="matchId" value={matchId} /></ActionForm>
          </div>
        )}
        <MatchSheet matchId={matchId} settings={settings} home={home} away={away} initialHome={match.home_score} initialAway={match.away_score} rows={rows} candidates={candidates} locked={matchday.status === "settled"} status={match.sheet_status} />
      </div>
    </main>
  );
}
