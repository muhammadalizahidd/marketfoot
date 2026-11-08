"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/admin";
import { audit } from "@/lib/admin/audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AdminActionState } from "./actions";

const uuid = z.string().uuid();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const flag = (form: FormData, key: string) => form.get(key) === "on" || form.get(key) === "true";
const refresh = (seasonId?: string) => { revalidatePath("/admin/saison"); if (seasonId) revalidatePath(`/admin/saison/${seasonId}`); };
const message = (code?: string) => ({
  OTHER_ACTIVE_SEASON: "Une autre saison est déjà en cours : terminez-la d’abord.",
  SEASON_NEEDS_TEAMS: "Sélectionnez au moins 2 équipes avant de valider.",
  INVALID_SEASON_STATE: "Cette action n’est pas possible dans l’état actuel de la saison.",
  OWNED_PLAYER_REASSIGNMENT_REQUIRES_REVIEW: "Ce joueur appartient à des managers : son poste ou son club ne peut pas être modifié sans revue.",
  STALE_RECORD: "La fiche a changé entre-temps, rechargez la page.",
}[code ?? ""] ?? "Opération refusée.");
const abbreviation = (name: string) => name.normalize("NFD").replace(/[^A-Za-z ]/g, "").split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 4).toUpperCase() || name.slice(0, 3).toUpperCase();

/** Creates a club that does not exist yet (promoted team) and returns its id. */
async function ensureClub(name: string, short: string | null) {
  const db = createSupabaseAdminClient();
  const clean = name.trim();
  const { data: existing } = await db.from("clubs").select("id").ilike("name", clean).maybeSingle();
  if (existing) return existing.id as string;
  const { data, error } = await db.from("clubs").insert({ name: clean, short_name: (short?.trim() || abbreviation(clean)).toUpperCase() }).select("id").single();
  if (error) throw new Error("Cette équipe ou son sigle existe déjà.");
  return data.id as string;
}

export async function createSeason(_: AdminActionState, form: FormData): Promise<AdminActionState> {
  const actor = await requireAdmin();
  const parsed = z.object({
    name: z.string().trim().min(3).max(60), starts_on: day, ends_on: day, intent: z.enum(["draft", "create"]),
    cloneFrom: z.union([uuid, z.literal("")]), valueMode: z.enum(["", "end", "start"]),
  }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Renseignez un nom (3 caractères minimum) et deux dates valides." };
  const input = parsed.data;
  if (input.ends_on < input.starts_on) return { error: "La date de fin précède la date de début." };
  const db = createSupabaseAdminClient();
  const clubIds = new Set(form.getAll("club").map(String).filter((id) => uuid.safeParse(id).success));
  const newTeams = form.getAll("newTeam").map((value) => String(value).trim()).filter(Boolean);
  try { for (const newTeam of newTeams) clubIds.add(await ensureClub(newTeam, null)); } catch (error) { return { error: (error as Error).message }; }
  if (input.intent === "create" && clubIds.size < 2) return { error: "Sélectionnez au moins 2 équipes." };
  const { data: season, error } = await db.from("seasons").insert({ name: input.name, starts_on: input.starts_on, ends_on: input.ends_on, is_current: false, status: input.intent === "draft" ? "draft" : "pending_validation" }).select("id").single();
  if (error) return { error: "Impossible de créer la saison (le nom est peut-être déjà utilisé)." };
  const undo = async (message: string): Promise<AdminActionState> => { await db.from("seasons").delete().eq("id", season.id); return { error: message }; };
  if (clubIds.size) {
    const { error: clubsError } = await db.from("season_clubs").insert([...clubIds].map((club_id) => ({ season_id: season.id, club_id })));
    if (clubsError) return undo("Impossible d’enregistrer les équipes de la saison.");
  }
  let copied = 0;
  if (input.cloneFrom && flag(form, "takeSquads") && clubIds.size) {
    const [{ data: source, error: sourceError }, { data: live }, { data: sourceSeason }] = await Promise.all([
      db.from("season_players").select("player_id,club_id,start_value,end_value").eq("season_id", input.cloneFrom).in("club_id", [...clubIds]),
      db.from("players").select("id,marketfoot_value"),
      db.from("seasons").select("status").eq("id", input.cloneFrom).single(),
    ]);
    if (sourceError) return undo("Impossible de lire les effectifs de la saison d’origine.");
    const current = new Map((live ?? []).map((p) => [p.id, Number(p.marketfoot_value)]));
    const rows = (source ?? []).map((row) => ({
      season_id: season.id, player_id: row.player_id, club_id: row.club_id,
      start_value: input.valueMode === "end" ? Number(row.end_value ?? (sourceSeason?.status === "active" ? current.get(row.player_id) : undefined) ?? row.start_value) : Number(row.start_value),
    }));
    if (rows.length) {
      const { error: copyError } = await db.from("season_players").insert(rows);
      if (copyError) return undo(`Copie des effectifs impossible (${copyError.message}).`);
      copied = rows.length;
    }
  }
  await audit(actor.id, "season.create", "season", season.id, { ...input, clubs: clubIds.size, copiedPlayers: copied });
  refresh();
  redirect(`/admin/saison/${season.id}`);
}

export async function saveSeasonInfo(_: AdminActionState, form: FormData): Promise<AdminActionState> {
  const actor = await requireAdmin();
  const parsed = z.object({ seasonId: uuid, name: z.string().trim().min(3).max(60), starts_on: day, ends_on: day, asDraft: z.string().optional() }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Vérifiez le nom et les dates." };
  const { seasonId, name, starts_on, ends_on, asDraft } = parsed.data;
  if (ends_on < starts_on) return { error: "La date de fin précède la date de début." };
  const db = createSupabaseAdminClient();
  const { data: before } = await db.from("seasons").select("*").eq("id", seasonId).single();
  if (!before) return { error: "Saison introuvable." };
  if (before.status === "finished") return { error: "Une saison terminée n’est plus modifiable." };
  const patch: Record<string, unknown> = { name, starts_on, ends_on };
  if (asDraft && before.status === "pending_validation") patch.status = "draft";
  const { error } = await db.from("seasons").update(patch).eq("id", seasonId);
  if (error) return { error: "Enregistrement impossible (nom déjà utilisé ?)." };
  await audit(actor.id, "season.update", "season", seasonId, patch, before);
  refresh(seasonId);
  return { success: asDraft ? "Brouillon enregistré." : "Saison enregistrée." };
}

export async function validateSeason(_: AdminActionState, form: FormData): Promise<AdminActionState> {
  const actor = await requireAdmin();
  const id = uuid.safeParse(form.get("seasonId"));
  if (!id.success) return { error: "Saison invalide." };
  const db = createSupabaseAdminClient();
  const { data: season } = await db.from("seasons").select("status").eq("id", id.data).single();
  if (season?.status === "draft") await db.from("seasons").update({ status: "pending_validation" }).eq("id", id.data);
  const { error } = await db.rpc("admin_activate_season", { p_actor: actor.id, p_season: id.data });
  if (error) { if (season?.status === "draft") await db.from("seasons").update({ status: "draft" }).eq("id", id.data); return { error: message(error.message.match(/[A-Z_]{6,}/)?.[0]) }; }
  refresh(id.data); revalidatePath("/admin");
  return { success: "Saison validée : elle est maintenant en cours." };
}

export async function finishSeason(_: AdminActionState, form: FormData): Promise<AdminActionState> {
  const actor = await requireAdmin();
  const id = uuid.safeParse(form.get("seasonId"));
  if (!id.success) return { error: "Saison invalide." };
  const { data, error } = await createSupabaseAdminClient().rpc("admin_finish_season", { p_actor: actor.id, p_season: id.data });
  if (error) return { error: message(error.message.match(/[A-Z_]{6,}/)?.[0]) };
  refresh(id.data); revalidatePath("/admin");
  return { success: `Saison terminée. Points palmarès attribués : ${data ?? 0}.` };
}

export async function deleteSeason(_: AdminActionState, form: FormData): Promise<AdminActionState> {
  const actor = await requireAdmin();
  const id = uuid.safeParse(form.get("seasonId"));
  if (!id.success) return { error: "Saison invalide." };
  const { error } = await createSupabaseAdminClient().rpc("admin_delete_resource", { p_actor: actor.id, p_resource: "seasons", p_id: id.data });
  if (error) return { error: "Suppression impossible : cette saison possède un historique (journées, matchs, effectifs de managers)." };
  refresh();
  return { success: "Saison supprimée." };
}

export async function addSeasonClub(_: AdminActionState, form: FormData): Promise<AdminActionState> {
  const actor = await requireAdmin();
  const seasonId = uuid.safeParse(form.get("seasonId"));
  if (!seasonId.success) return { error: "Saison invalide." };
  const db = createSupabaseAdminClient();
  const { data: season } = await db.from("seasons").select("status").eq("id", seasonId.data).single();
  if (!season || season.status === "finished") return { error: "Cette saison n’est plus modifiable." };
  let clubId: string;
  const raw = String(form.get("clubId") ?? "");
  try { clubId = raw === "__new__" ? await ensureClub(String(form.get("newName") ?? ""), null) : uuid.parse(raw); } catch { return { error: "Équipe invalide ou déjà existante." }; }
  const { error } = await db.from("season_clubs").insert({ season_id: seasonId.data, club_id: clubId });
  if (error) return { error: "Cette équipe fait déjà partie de la saison." };
  await audit(actor.id, "season.club.add", "season", seasonId.data, { clubId });
  refresh(seasonId.data);
  return { success: "Équipe ajoutée." };
}

export async function removeSeasonClub(_: AdminActionState, form: FormData): Promise<AdminActionState> {
  const actor = await requireAdmin();
  const parsed = z.object({ seasonId: uuid, clubId: uuid }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Données invalides." };
  const db = createSupabaseAdminClient();
  const { data: season } = await db.from("seasons").select("status").eq("id", parsed.data.seasonId).single();
  if (!season || season.status === "finished") return { error: "Cette saison n’est plus modifiable." };
  const { data: days } = await db.from("matchdays").select("id").eq("season_id", parsed.data.seasonId);
  const dayIds = (days ?? []).map((d) => d.id);
  if (dayIds.length) {
    const { count } = await db.from("matches").select("id", { count: "exact", head: true }).in("matchday_id", dayIds).or(`home_club_id.eq.${parsed.data.clubId},away_club_id.eq.${parsed.data.clubId}`);
    if (count) return { error: "Cette équipe a des matchs programmés dans la saison : supprimez-les d’abord." };
  }
  await db.from("season_players").delete().eq("season_id", parsed.data.seasonId).eq("club_id", parsed.data.clubId);
  await db.from("season_clubs").delete().eq("season_id", parsed.data.seasonId).eq("club_id", parsed.data.clubId);
  await audit(actor.id, "season.club.remove", "season", parsed.data.seasonId, { clubId: parsed.data.clubId });
  refresh(parsed.data.seasonId);
  return { success: "Équipe retirée de la saison." };
}

/** Club identity: full name, abbreviation and crest (stored in the public `crests` bucket). */
export async function saveClub(_: AdminActionState, form: FormData): Promise<AdminActionState> {
  const actor = await requireAdmin();
  const parsed = z.object({ clubId: uuid, seasonId: uuid, name: z.string().trim().min(2).max(60), short_name: z.string().trim().min(2).max(8) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Nom (2 caractères minimum) et abréviation (2 à 8 caractères) requis." };
  const db = createSupabaseAdminClient();
  const { data: before } = await db.from("clubs").select("*").eq("id", parsed.data.clubId).single();
  if (!before) return { error: "Équipe introuvable." };
  const patch: Record<string, unknown> = { name: parsed.data.name, short_name: parsed.data.short_name.toUpperCase() };
  const file = form.get("crest");
  if (file instanceof File && file.size > 0) {
    if (!["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(file.type) || file.size > 1_500_000) return { error: "Écusson : image PNG, JPG, WebP ou SVG de 1,5 Mo maximum." };
    const path = `${parsed.data.clubId}-${Date.now()}.${file.type === "image/svg+xml" ? "svg" : file.type.split("/")[1].replace("jpeg", "jpg")}`;
    const { error: uploadError } = await db.storage.from("crests").upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: true });
    if (uploadError) return { error: "Téléversement de l’écusson impossible." };
    patch.crest_url = db.storage.from("crests").getPublicUrl(path).data.publicUrl;
  }
  const { error } = await db.from("clubs").update(patch).eq("id", parsed.data.clubId);
  if (error) return { error: "Ce nom ou cette abréviation est déjà utilisé." };
  await audit(actor.id, "club.update", "club", parsed.data.clubId, patch, before);
  refresh(parsed.data.seasonId); revalidatePath("/ligue-1");
  return { success: "Équipe enregistrée." };
}

const positionEnum = z.enum(["GK", "DF", "MF", "FW"]);

async function editPlayer(actorId: string, playerId: string, changes: Record<string, unknown>): Promise<string | null> {
  const db = createSupabaseAdminClient();
  const { data: before } = await db.from("players").select("*").eq("id", playerId).single();
  if (!before) return "Joueur introuvable.";
  const effective = Object.fromEntries(Object.entries(changes).filter(([key, value]) => (before as Record<string, unknown>)[key] !== value));
  if (!Object.keys(effective).length) return null;
  const { error } = await db.rpc("admin_edit_resource", { p_actor: actorId, p_resource: "players", p_id: playerId, p_before: before, p_changes: effective });
  return error ? message(error.message.match(/[A-Z_]{6,}/)?.[0]) : null;
}

/** Saves every row of one club roster. Row fields are named `p.<playerId>.<field>`. */
export async function saveRoster(_: AdminActionState, form: FormData): Promise<AdminActionState> {
  const actor = await requireAdmin();
  const ids = z.object({ seasonId: uuid, clubId: uuid }).safeParse(Object.fromEntries(form));
  if (!ids.success) return { error: "Données invalides." };
  const db = createSupabaseAdminClient();
  const { data: season } = await db.from("seasons").select("status").eq("id", ids.data.seasonId).single();
  if (!season || season.status === "finished") return { error: "Cette saison n’est plus modifiable." };
  const rows = new Map<string, Record<string, string>>();
  for (const [key, value] of form.entries()) {
    const match = /^p\.([0-9a-f-]{36})\.(first_name|last_name|position|value)$/.exec(key);
    if (match && typeof value === "string") rows.set(match[1], { ...(rows.get(match[1]) ?? {}), [match[2]]: value });
  }
  let saved = 0;
  for (const [playerId, row] of rows) {
    const parsed = z.object({ first_name: z.string().trim().max(60), last_name: z.string().trim().min(1).max(60), position: positionEnum, value: z.coerce.number().min(500000) }).safeParse(row);
    if (!parsed.success) return { error: "Chaque joueur doit avoir un nom, un poste et une valeur d’au moins 500 000 €." };
    const changes: Record<string, unknown> = { first_name: parsed.data.first_name, last_name: parsed.data.last_name, position: parsed.data.position };
    if (season.status === "active") changes.marketfoot_value = parsed.data.value;
    const failure = await editPlayer(actor.id, playerId, changes);
    if (failure) return { error: failure };
    await db.from("season_players").update({ start_value: parsed.data.value }).eq("season_id", ids.data.seasonId).eq("player_id", playerId);
    saved += 1;
  }
  await audit(actor.id, "season.roster.save", "season", ids.data.seasonId, { clubId: ids.data.clubId, players: saved });
  refresh(ids.data.seasonId);
  return { success: `${saved} joueur(s) enregistré(s).` };
}

/** Adds an existing player (moving him from another club when `confirmMove`) or creates a new one from the typed name. */
export async function addSeasonPlayer(_: AdminActionState, form: FormData): Promise<AdminActionState> {
  const actor = await requireAdmin();
  const ids = z.object({ seasonId: uuid, clubId: uuid }).safeParse(Object.fromEntries(form));
  if (!ids.success) return { error: "Données invalides." };
  const db = createSupabaseAdminClient();
  const { data: season } = await db.from("seasons").select("status").eq("id", ids.data.seasonId).single();
  if (!season || season.status === "finished") return { error: "Cette saison n’est plus modifiable." };
  const raw = String(form.get("playerId") ?? "");
  let playerId: string;
  let value = 500000;
  if (raw === "__new__") {
    const full = String(form.get("newName") ?? "").trim().replace(/\s+/g, " ");
    if (full.length < 2) return { error: "Saisissez le nom du nouveau joueur." };
    const [first, ...rest] = full.split(" ");
    const lastName = rest.join(" ") || first;
    const { data, error } = await db.from("players").insert({ club_id: ids.data.clubId, first_name: rest.length ? first : "", last_name: lastName, position: "MF", vm_value: value, marketfoot_value: value, is_active: season.status === "active" }).select("id").single();
    if (error) return { error: "Création du joueur impossible." };
    playerId = data.id;
  } else {
    const id = uuid.safeParse(raw);
    if (!id.success) return { error: "Joueur invalide." };
    playerId = id.data;
    const { data: player } = await db.from("players").select("marketfoot_value,club_id").eq("id", playerId).single();
    if (!player) return { error: "Joueur introuvable." };
    value = Number(player.marketfoot_value);
    const { data: existing } = await db.from("season_players").select("club_id").eq("season_id", ids.data.seasonId).eq("player_id", playerId).maybeSingle();
    if (existing && existing.club_id !== ids.data.clubId) {
      if (!flag(form, "confirmMove")) return { error: "Confirmez le déplacement du joueur." };
      if (season.status === "active") { const failure = await editPlayer(actor.id, playerId, { club_id: ids.data.clubId }); if (failure) return { error: failure }; }
      await db.from("season_players").update({ club_id: ids.data.clubId }).eq("season_id", ids.data.seasonId).eq("player_id", playerId);
      await audit(actor.id, "season.player.move", "player", playerId, { seasonId: ids.data.seasonId, to: ids.data.clubId }, existing);
      refresh(ids.data.seasonId);
      return { success: "Joueur déplacé." };
    }
    if (existing) return { error: "Ce joueur fait déjà partie de cette équipe." };
    if (season.status === "active") { const failure = await editPlayer(actor.id, playerId, { club_id: ids.data.clubId, is_active: true }); if (failure) return { error: failure }; }
  }
  const { error } = await db.from("season_players").insert({ season_id: ids.data.seasonId, player_id: playerId, club_id: ids.data.clubId, start_value: value });
  if (error) return { error: "Impossible d’ajouter ce joueur à l’effectif." };
  await audit(actor.id, "season.player.add", "player", playerId, { seasonId: ids.data.seasonId, clubId: ids.data.clubId });
  refresh(ids.data.seasonId);
  return { success: "Joueur ajouté." };
}

export async function removeSeasonPlayer(_: AdminActionState, form: FormData): Promise<AdminActionState> {
  const actor = await requireAdmin();
  const ids = z.object({ seasonId: uuid, playerId: uuid }).safeParse(Object.fromEntries(form));
  if (!ids.success) return { error: "Données invalides." };
  const db = createSupabaseAdminClient();
  const { data: season } = await db.from("seasons").select("status").eq("id", ids.data.seasonId).single();
  if (!season || season.status === "finished") return { error: "Cette saison n’est plus modifiable." };
  if (season.status === "active") { const failure = await editPlayer(actor.id, ids.data.playerId, { is_active: false }); if (failure) return { error: failure }; }
  await db.from("season_players").delete().eq("season_id", ids.data.seasonId).eq("player_id", ids.data.playerId);
  await audit(actor.id, "season.player.remove", "player", ids.data.playerId, { seasonId: ids.data.seasonId });
  refresh(ids.data.seasonId);
  return { success: "Joueur retiré de l’effectif." };
}
