"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/admin";
import { audit } from "@/lib/admin/audit";
import { parisToIso } from "@/lib/admin/format";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { validatePlayerMatchInput } from "@/rules";
import type { AdminActionState } from "./actions";

const uuid = z.string().uuid();
const refresh = (day?: number) => { revalidatePath("/admin/saisie"); revalidatePath("/admin"); if (day) revalidatePath(`/admin/saisie?day=${day}`); revalidatePath("/ligue-1"); revalidatePath("/mon-equipe"); };

async function getOrCreateMatchday(seasonId: string, number: number) {
  const db = createSupabaseAdminClient();
  const { data: existing } = await db.from("matchdays").select("*").eq("season_id", seasonId).eq("number", number).maybeSingle();
  if (existing) return existing;
  const { data, error } = await db.from("matchdays").insert({ season_id: seasonId, number }).select("*").single();
  if (error) throw new Error("Impossible de créer la journée.");
  return data;
}

/**
 * "Enregistrer" on the Saisie screen: the 9 match rows (`row.N.id|date|time|home|away`) and the "Déroulé" schedule
 * (`mercato_open|close|thaw` date + time, Europe/Paris wall clock).
 */
export async function saveMatchday(_: AdminActionState, form: FormData): Promise<AdminActionState> {
  const actor = await requireAdmin();
  const ids = z.object({ seasonId: uuid, number: z.coerce.number().int().min(1).max(40) }).safeParse(Object.fromEntries(form));
  if (!ids.success) return { error: "Journée invalide." };
  const db = createSupabaseAdminClient();
  let matchday;
  try { matchday = await getOrCreateMatchday(ids.data.seasonId, ids.data.number); } catch (error) { return { error: (error as Error).message }; }
  const rows = new Map<number, Record<string, string>>();
  for (const [key, value] of form.entries()) {
    const match = /^row\.(\d+)\.(id|date|time|home|away)$/.exec(key);
    if (match && typeof value === "string") rows.set(Number(match[1]), { ...(rows.get(Number(match[1])) ?? {}), [match[2]]: value });
  }
  const { data: allowed } = await db.from("season_clubs").select("club_id").eq("season_id", ids.data.seasonId);
  const seasonClubs = new Set((allowed ?? []).map((row) => row.club_id));
  const { data: existing } = await db.from("matches").select("id,home_club_id,away_club_id,player_match_stats(id)").eq("matchday_id", matchday.id);
  type Operation = { id: string | null; kickoff: string; home: string; away: string };
  const operations: Operation[] = [];
  const used = new Set<string>();
  // 1. Validate every row before anything is written, so an error never leaves a half-saved matchday.
  for (const row of [...rows.values()]) {
    if (!row.home && !row.away && !row.date && !row.time) continue;
    if (!row.home || !row.away || !row.date || !row.time) return { error: "Chaque match doit avoir une date, une heure et deux équipes." };
    if (row.home === row.away) return { error: "Une équipe ne peut pas jouer contre elle-même." };
    if (seasonClubs.size && (!seasonClubs.has(row.home) || !seasonClubs.has(row.away))) return { error: "Une équipe sélectionnée ne fait pas partie de la saison." };
    for (const club of [row.home, row.away]) { if (used.has(club)) return { error: "Une équipe ne peut jouer qu’un match par journée." }; used.add(club); }
    const kickoff = parisToIso(row.date, row.time);
    if (!kickoff) return { error: "Date ou heure invalide." };
    // A row without an id that matches an existing fixture is an update (makes re-submitting idempotent).
    const known = existing?.find((match) => match.id === row.id) ?? existing?.find((match) => !row.id && match.home_club_id === row.home && match.away_club_id === row.away);
    if (known && (known.home_club_id !== row.home || known.away_club_id !== row.away) && (known.player_match_stats?.length ?? 0) > 0) return { error: "Les équipes d’un match qui a une feuille de match ne peuvent plus changer." };
    operations.push({ id: known?.id ?? null, kickoff, home: row.home, away: row.away });
  }
  const instantFor = (name: string) => { const date = String(form.get(`${name}_date`) ?? ""); const time = String(form.get(`${name}_time`) ?? ""); return date && time ? parisToIso(date, time) : null; };
  const patch = { mercato_opens_at: instantFor("mercato_open"), mercato_closes_at: instantFor("mercato_close"), thaw_at: instantFor("thaw") };
  if (patch.mercato_opens_at && patch.mercato_closes_at && patch.mercato_closes_at <= patch.mercato_opens_at) return { error: "La fermeture du mercato doit suivre son ouverture." };
  if (patch.mercato_closes_at && patch.thaw_at && patch.thaw_at < patch.mercato_closes_at) return { error: "Le dégel du site doit suivre la fermeture du mercato." };
  // 2. Apply.
  for (const op of operations) {
    const values = { kickoff_at: op.kickoff, home_club_id: op.home, away_club_id: op.away };
    const { error } = op.id ? await db.from("matches").update(values).eq("id", op.id) : await db.from("matches").insert({ matchday_id: matchday.id, ...values });
    if (error) return { error: "Impossible d’enregistrer un match." };
  }
  const saved = operations.length;
  await db.from("matchdays").update(patch).eq("id", matchday.id);
  await audit(actor.id, "matchday.schedule.save", "matchday", matchday.id, { matches: saved, ...patch });
  refresh(ids.data.number);
  return { success: `Journée ${ids.data.number} enregistrée (${saved} match${saved > 1 ? "s" : ""}).` };
}

export async function postponeMatch(_: AdminActionState, form: FormData): Promise<AdminActionState> {
  const actor = await requireAdmin();
  const parsed = z.object({ matchId: uuid, date: z.string().optional(), time: z.string().optional() }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Match invalide." };
  const db = createSupabaseAdminClient();
  const { data: before } = await db.from("matches").select("*").eq("id", parsed.data.matchId).single();
  if (!before) return { error: "Match introuvable." };
  const { data: day } = await db.from("matchdays").select("status").eq("id", before.matchday_id).single();
  if (day?.status === "settled") return { error: "La journée est déjà réglée : utilisez la correction de règlement." };
  const patch: Record<string, unknown> = { is_postponed: true };
  if (parsed.data.date && parsed.data.time) { const kickoff = parisToIso(parsed.data.date, parsed.data.time); if (!kickoff) return { error: "Date ou heure invalide." }; patch.kickoff_at = kickoff; }
  const { error } = await db.from("matches").update(patch).eq("id", parsed.data.matchId);
  if (error) return { error: "Impossible de reporter le match." };
  await audit(actor.id, "match.postpone", "match", parsed.data.matchId, patch, before);
  refresh();
  return { success: "Match reporté : il est exclu des pronostics et du règlement jusqu’à sa nouvelle date." };
}

/** "Publier": opens a draft matchday to gamers, or prepares the settlement of a closed one. */
export async function publishMatchday(_: AdminActionState, form: FormData): Promise<AdminActionState> {
  const actor = await requireAdmin();
  const parsed = z.object({ matchdayId: uuid }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Journée invalide." };
  const db = createSupabaseAdminClient();
  const { data: day } = await db.from("matchdays").select("id,number,status").eq("id", parsed.data.matchdayId).single();
  if (!day) return { error: "Journée introuvable." };
  if (day.status === "draft") {
    const { count } = await db.from("matches").select("id", { count: "exact", head: true }).eq("matchday_id", day.id);
    if (!count) return { error: "Ajoutez au moins un match avant de publier la journée." };
    const { error } = await db.rpc("admin_transition_matchday", { p_actor_id: actor.id, p_matchday_id: day.id, p_next_status: "open" });
    if (error) return { error: "Publication impossible : une journée précédente est peut-être encore ouverte." };
    refresh(day.number);
    return { success: `Journée ${day.number} publiée : les managers peuvent composer leur équipe.` };
  }
  if (day.status === "closed") {
    const { data: unvalidated } = await db.from("matches").select("id").eq("matchday_id", day.id).eq("is_postponed", false).neq("sheet_status", "validated").limit(1);
    if (unvalidated?.length) return { error: "Toutes les feuilles de match (hors matchs reportés) doivent être validées avant le règlement." };
    const { data: active } = await db.from("matchday_settlements").select("id").eq("matchday_id", day.id).in("status", ["pending", "running", "completed"]).limit(1);
    if (active?.length) redirect(`/admin/saisie/publication`);
    const { count } = await db.from("matchday_settlements").select("id", { count: "exact", head: true }).eq("matchday_id", day.id);
    const { error } = await db.from("matchday_settlements").insert({ matchday_id: day.id, rules_version: "v3.2.0", attempt: (count ?? 0) + 1, requested_by: actor.id });
    if (error) return { error: "Impossible de préparer le règlement." };
    await audit(actor.id, "settlement.request", "matchday", day.id, { attempt: (count ?? 0) + 1 });
    refresh(day.number);
    redirect("/admin/saisie/publication");
  }
  return { error: day.status === "settled" ? "Cette journée est déjà publiée et réglée." : "La journée doit être clôturée (Mercato terminé) avant le règlement." };
}

const statFields = ["goals", "assists", "penalties_scored", "own_goals", "penalties_missed", "yellow_cards", "red_cards", "saves", "stoppage_time_goals"] as const;

/**
 * Saves a whole match sheet. Row fields: `s.<playerId>.started|minutes|<stat>`. `intent` is "draft" or "validate".
 * Substitutions are derived: a starter who leaves before 90' without a red card is "remplacé"; a non-starter who plays came on.
 */
export async function saveMatchSheet(_: AdminActionState, form: FormData): Promise<AdminActionState> {
  const actor = await requireAdmin();
  const head = z.object({ matchId: uuid, intent: z.enum(["draft", "validate"]), home_score: z.coerce.number().int().min(0).max(30), away_score: z.coerce.number().int().min(0).max(30) }).safeParse(Object.fromEntries(form));
  if (!head.success) return { error: "Renseignez le score du match." };
  const db = createSupabaseAdminClient();
  const { data: match } = await db.from("matches").select("*").eq("id", head.data.matchId).single();
  if (!match) return { error: "Match introuvable." };
  const { data: day } = await db.from("matchdays").select("number,status").eq("id", match.matchday_id).single();
  if (day?.status === "settled") return { error: "Journée déjà réglée : annulez le règlement (correction historique) avant de modifier la feuille." };
  const rows = new Map<string, Record<string, string>>();
  for (const [key, value] of form.entries()) {
    const m = /^s\.([0-9a-f-]{36})\.(started|minutes|goals|assists|penalties_scored|own_goals|penalties_missed|yellow_cards|red_cards|saves|stoppage_time_goals)$/.exec(key);
    if (m && typeof value === "string") rows.set(m[1], { ...(rows.get(m[1]) ?? {}), [m[2]]: value });
  }
  const records = [];
  for (const [playerId, row] of rows) {
    const num = (key: string) => Math.max(0, Math.floor(Number(row[key] ?? 0)) || 0);
    const started = row.started === "true";
    const minutes = num("minutes");
    const record = {
      match_id: head.data.matchId, player_id: playerId, started, minutes_played: minutes,
      ...Object.fromEntries(statFields.map((field) => [field, num(field)])),
      penalties_saved: 0,
      substitutions_out: started && minutes > 0 && minutes < 90 && num("red_cards") === 0 ? 1 : 0,
      substitutions_in: !started && minutes > 0 ? 1 : 0,
    } as Record<string, number | boolean | string>;
    const invalid = validatePlayerMatchInput({ started, minutesPlayed: minutes, goals: record.goals as number, assists: record.assists as number, ownGoals: record.own_goals as number, yellowCards: record.yellow_cards as number, redCards: record.red_cards as number, penaltiesScored: record.penalties_scored as number, penaltiesMissed: record.penalties_missed as number, penaltiesSaved: 0, saves: record.saves as number });
    if (invalid) return { error: `${invalid} (joueur ${playerId.slice(0, 8)})` };
    records.push(record);
  }
  if (head.data.intent === "validate" && !records.some((record) => record.started)) return { error: "Renseignez au moins la composition d’une équipe avant de valider." };
  if (records.length) {
    const { error } = await db.from("player_match_stats").upsert(records, { onConflict: "match_id,player_id" });
    if (error) return { error: "Impossible d’enregistrer les statistiques." };
  }
  const removed = form.getAll("remove").map(String).filter((value) => uuid.safeParse(value).success);
  if (removed.length) await db.from("player_match_stats").delete().eq("match_id", head.data.matchId).in("player_id", removed);
  const patch = { home_score: head.data.home_score, away_score: head.data.away_score, sheet_status: head.data.intent === "validate" ? "validated" : "draft", ...(head.data.intent === "validate" ? { is_postponed: false } : {}) };
  const { error } = await db.from("matches").update(patch).eq("id", head.data.matchId);
  if (error) return { error: "Impossible d’enregistrer le score." };
  await audit(actor.id, head.data.intent === "validate" ? "match.sheet.validate" : "match.sheet.draft", "match", head.data.matchId, { ...patch, players: records.length }, match);
  refresh(day?.number);
  revalidatePath(`/admin/saisie/${day?.number}/${head.data.matchId}`);
  return { success: head.data.intent === "validate" ? "Feuille de match validée." : "Brouillon enregistré." };
}

/** Adds the missing roster players of both clubs to the sheet (all with 0 minute) so the admin can fill them in. */
export async function prefillMatchSheet(_: AdminActionState, form: FormData): Promise<AdminActionState> {
  const actor = await requireAdmin();
  const id = uuid.safeParse(form.get("matchId"));
  if (!id.success) return { error: "Match invalide." };
  const db = createSupabaseAdminClient();
  const { data: match } = await db.from("matches").select("matchday_id,home_club_id,away_club_id").eq("id", id.data).single();
  if (!match) return { error: "Match introuvable." };
  const { data: players } = await db.from("players").select("id").eq("is_active", true).in("club_id", [match.home_club_id, match.away_club_id]);
  const { data: existing } = await db.from("player_match_stats").select("player_id").eq("match_id", id.data);
  const have = new Set((existing ?? []).map((row) => row.player_id));
  const rows = (players ?? []).filter((p) => !have.has(p.id)).map((p) => ({ match_id: id.data, player_id: p.id }));
  if (rows.length) await db.from("player_match_stats").insert(rows);
  await audit(actor.id, "match.sheet.prefill", "match", id.data, { added: rows.length });
  revalidatePath("/admin/saisie", "layout");
  return { success: `${rows.length} joueur(s) ajouté(s) à la feuille.` };
}

export async function addSheetPlayer(_: AdminActionState, form: FormData): Promise<AdminActionState> {
  const actor = await requireAdmin();
  const parsed = z.object({ matchId: uuid, playerId: uuid }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Joueur invalide." };
  const { error } = await createSupabaseAdminClient().from("player_match_stats").upsert({ match_id: parsed.data.matchId, player_id: parsed.data.playerId }, { onConflict: "match_id,player_id", ignoreDuplicates: true });
  if (error) return { error: "Impossible d’ajouter ce joueur." };
  await audit(actor.id, "match.sheet.add_player", "match", parsed.data.matchId, { playerId: parsed.data.playerId });
  revalidatePath("/admin/saisie", "layout");
  return { success: "Joueur ajouté." };
}

export async function removeSheetPlayer(_: AdminActionState, form: FormData): Promise<AdminActionState> {
  const actor = await requireAdmin();
  const parsed = z.object({ matchId: uuid, playerId: uuid }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Joueur invalide." };
  const { error } = await createSupabaseAdminClient().from("player_match_stats").delete().eq("match_id", parsed.data.matchId).eq("player_id", parsed.data.playerId);
  if (error) return { error: "Impossible de retirer ce joueur." };
  await audit(actor.id, "match.sheet.remove_player", "match", parsed.data.matchId, { playerId: parsed.data.playerId });
  revalidatePath("/admin/saisie", "layout");
  return { success: "Joueur retiré de la feuille." };
}
