import Link from "next/link";
import { redirect } from "next/navigation";
import { isTeamFrozen } from "@/rules/freeze";
import { one } from "@/lib/supabase/relation";
import { getCurrentUserId } from "@/lib/auth/session";
import { getMySquad } from "@/data/repositories/squad-repository";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { LineupManager, type SquadMemberView } from "@/features/squad/lineup-manager";
import type { BonusState } from "@/components/team/bonus-panel";
import { bonusCatalogue } from "@/lib/bonus-catalogue";
import { ensureRulesSettings } from "@/services/rules-settings";
import { getTeamFreezeTime } from "@/rules/freeze";

export default async function MyTeamPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const userId = await getCurrentUserId(); if (!userId) redirect("/connexion");
  const requested = (await searchParams).tab;
  if (requested === "transfert") redirect("/transferts");
  const active = requested === "capitaine" ? "capitaine" : "composition";
  const squad = await getMySquad(userId);
  if (!squad) return <main className="app-page"><section className="empty-state"><h1>Votre équipe n’est pas encore créée</h1><p>Composez votre effectif de 19 joueurs pour commencer.</p><Link className="primary-action" href="/onboarding">Créer mon équipe</Link></section></main>;
  const db = createSupabaseAdminClient();
  const playerIds = (squad.squad_members ?? []).map((m) => m.player_id);
  const [{ data: current }, { data: holderRows }] = await Promise.all([
    db.from("matchdays").select("id").in("status", ["open", "mercado"]).order("number").limit(1).maybeSingle(),
    playerIds.length ? db.from("squad_members").select("player_id").in("player_id", playerIds) : Promise.resolve({ data: [] as { player_id: string }[] }),
  ]);
  const { data: fixtures } = current ? await db.from("matches").select("home_club_id,away_club_id,kickoff_at").eq("matchday_id", current.id) : { data: [] };
  const { settings } = await ensureRulesSettings();
  const { data: season } = await db.from("seasons").select("id").eq("is_current", true).maybeSingle();
  const { data: plays } = season ? await db.from("bonus_plays").select("matchday_id,bonus_id").eq("squad_id", squad.id).eq("season_id", season.id) : { data: [] as { matchday_id: string; bonus_id: string }[] };
  const firstKickoff = (fixtures ?? []).map((m) => new Date(m.kickoff_at).getTime()).sort((a, b) => a - b)[0];
  const bonus: BonusState = {
    matchdayId: current?.id ?? null,
    chosen: (plays ?? []).find((p) => p.matchday_id === current?.id)?.bonus_id ?? null,
    used: Object.fromEntries(bonusCatalogue.map((b) => [b.id, (plays ?? []).filter((p) => p.bonus_id === b.id && p.matchday_id !== current?.id).length])),
    max: Object.fromEntries(settings.bonus.list.map((b) => [b.id, b.maxPerSeason])),
    enabled: Object.fromEntries(settings.bonus.list.map((b) => [b.id, b.enabled])),
    gainPct: settings.bonus.gainPct,
    locked: firstKickoff !== undefined && new Date() >= getTeamFreezeTime(new Date(firstKickoff)),
  };
  const owners = new Map<string, number>();
  for (const row of holderRows ?? []) owners.set(row.player_id, (owners.get(row.player_id) ?? 0) + 1);
  const frozen = new Set((fixtures ?? []).filter((m) => isTeamFrozen(new Date(m.kickoff_at), new Date())).flatMap((m) => [m.home_club_id, m.away_club_id]));
  const members: SquadMemberView[] = (squad.squad_members ?? []).map((m) => ({ id: m.player_id, name: `${one(m.players)?.first_name ?? ""} ${one(m.players)?.last_name ?? ""}`.trim(), position: one(m.players)?.position ?? "—", value: Number(one(m.players)?.marketfoot_value ?? m.acquired_value), isStarter: m.is_starter, isCaptain: m.is_captain, frozen: frozen.has(one(m.players)?.club_id ?? ""), clubName: one(one(m.players)?.clubs)?.name ?? "", acquiredValue: Number(m.acquired_value), owners: owners.get(m.player_id) ?? 1 }));
  return <main className="app-page" style={{ padding: 0 }}><LineupManager activeTab={active} members={members} matchdayId={current?.id ?? null} bonus={bonus}/></main>;
}
