"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/admin";
import { audit } from "@/lib/admin/audit";
import { usernameSchema } from "@/lib/validation/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { bonusIds } from "@/rules/settings";
import type { AdminActionState } from "./actions";

const uuid = z.string().uuid();
const refresh = (id?: string) => { revalidatePath("/admin/managers"); if (id) revalidatePath(`/admin/managers/${id}`); };
const code = (message: string) => message.match(/[A-Z][A-Z_]{5,}/)?.[0];

async function loadManager(id: string) {
  const { data } = await createSupabaseAdminClient().from("profiles").select("*").eq("id", id).maybeSingle();
  return data && data.role === "gamer" ? data : null;
}

export async function updateManagerProfile(_: AdminActionState, form: FormData): Promise<AdminActionState> {
  const actor = await requireAdmin();
  const parsed = z.object({ managerId: uuid, username: usernameSchema, favorite_club_id: z.union([uuid, z.literal("")]), bio: z.string().max(80), country: z.string().max(80), removeAvatar: z.string().optional() }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Pseudo (3 à 32 caractères), biographie (80 max) ou pays invalide." };
  const before = await loadManager(parsed.data.managerId);
  if (!before) return { error: "Manager introuvable." };
  const patch: Record<string, unknown> = { username: parsed.data.username, favorite_club_id: parsed.data.favorite_club_id || null, bio: parsed.data.bio.trim() || null, country: parsed.data.country.trim() || null };
  if (parsed.data.removeAvatar) patch.avatar_url = null;
  const { error } = await createSupabaseAdminClient().from("profiles").update(patch).eq("id", before.id);
  if (error) return { error: error.code === "23505" ? "Ce pseudo est déjà utilisé." : "Enregistrement impossible." };
  await audit(actor.id, "manager.update", "profile", before.id, patch, { username: before.username, favorite_club_id: before.favorite_club_id, bio: before.bio, country: before.country });
  refresh(before.id);
  return { success: "Profil enregistré." };
}

export async function banManager(_: AdminActionState, form: FormData): Promise<AdminActionState> {
  const actor = await requireAdmin();
  const parsed = z.object({ managerId: uuid, reason: z.string().trim().min(3).max(200) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Indiquez le motif du bannissement (3 caractères minimum)." };
  const manager = await loadManager(parsed.data.managerId);
  if (!manager) return { error: "Manager introuvable." };
  const db = createSupabaseAdminClient();
  const { error } = await db.auth.admin.updateUserById(manager.id, { ban_duration: "876000h" });
  if (error) return { error: "Le blocage de la connexion a échoué." };
  await db.from("profiles").update({ banned_at: new Date().toISOString(), banned_reason: parsed.data.reason }).eq("id", manager.id);
  await audit(actor.id, "manager.ban", "profile", manager.id, { reason: parsed.data.reason });
  refresh(manager.id);
  return { success: "Compte banni : la connexion est bloquée et la session sera fermée." };
}

export async function unbanManager(_: AdminActionState, form: FormData): Promise<AdminActionState> {
  const actor = await requireAdmin();
  const id = uuid.safeParse(form.get("managerId"));
  if (!id.success) return { error: "Manager invalide." };
  const db = createSupabaseAdminClient();
  const { error } = await db.auth.admin.updateUserById(id.data, { ban_duration: "none" });
  if (error) return { error: "Le déblocage a échoué." };
  await db.from("profiles").update({ banned_at: null, banned_reason: null }).eq("id", id.data);
  await audit(actor.id, "manager.unban", "profile", id.data, {});
  refresh(id.data);
  return { success: "Compte réactivé." };
}

/** Deletes the account; when history (ledger, snapshots, predictions…) forbids it, the account is anonymised and locked instead. */
export async function deleteManager(_: AdminActionState, form: FormData): Promise<AdminActionState> {
  const actor = await requireAdmin();
  const id = uuid.safeParse(form.get("managerId"));
  if (!id.success) return { error: "Manager invalide." };
  const manager = await loadManager(id.data);
  if (!manager) return { error: "Manager introuvable." };
  const db = createSupabaseAdminClient();
  // A never-played account only owns the starter allocation created at sign-up: clear it so the account can be removed outright.
  const [{ data: squad }, { data: ledger }] = await Promise.all([
    db.from("squads").select("id").eq("gamer_id", manager.id).maybeSingle(),
    db.from("financial_ledger").select("event_type").eq("gamer_id", manager.id),
  ]);
  if (!squad && (ledger ?? []).every((entry) => entry.event_type === "initial_allocation")) {
    await db.from("financial_ledger").delete().eq("gamer_id", manager.id);
    await db.from("gamer_finances").delete().eq("gamer_id", manager.id);
  }
  const { error } = await db.auth.admin.deleteUser(manager.id);
  if (!error) { await audit(actor.id, "manager.delete", "profile", manager.id, { mode: "deleted" }, { username: manager.username }); refresh(); return { success: "Compte supprimé." }; }
  const alias = `supprime-${manager.id.slice(0, 8)}`;
  await db.auth.admin.updateUserById(manager.id, { ban_duration: "876000h", email: `${alias}@deleted.invalid` });
  await db.from("profiles").update({ username: alias, avatar_url: null, bio: null, country: null, favorite_club_id: null, banned_at: new Date().toISOString(), banned_reason: "Compte supprimé", deletion_requested_at: new Date().toISOString() }).eq("id", manager.id);
  await db.from("profile_ip_events").delete().eq("gamer_id", manager.id);
  await audit(actor.id, "manager.delete", "profile", manager.id, { mode: "anonymised" }, { username: manager.username });
  refresh();
  return { success: "Le compte a un historique de jeu : il a été anonymisé et verrouillé (les classements restent cohérents)." };
}

export async function resetManager(_: AdminActionState, form: FormData): Promise<AdminActionState> {
  const actor = await requireAdmin();
  const id = uuid.safeParse(form.get("managerId"));
  if (!id.success) return { error: "Manager invalide." };
  const { error } = await createSupabaseAdminClient().rpc("admin_reset_manager", { p_actor: actor.id, p_gamer: id.data });
  if (error) return { error: ({ NO_SQUAD: "Ce manager n’a pas encore d’équipe.", INITIAL_BUDGET_UNAVAILABLE: "Le budget initial ne peut pas être calculé (aucun joueur actif).", CANNOT_RESET_ADMIN: "Un administrateur ne peut pas être réinitialisé." } as Record<string, string>)[code(error.message) ?? ""] ?? "Réinitialisation impossible." };
  refresh(id.data); revalidatePath("/mon-equipe");
  return { success: "Compte réinitialisé : l’équipe doit être reconstruite, le compte bloqué est conservé." };
}

/** "Corriger": sets the new amount; the difference is written to the ledger with a mandatory reason. */
export async function adjustFinance(_: AdminActionState, form: FormData): Promise<AdminActionState> {
  const actor = await requireAdmin();
  const parsed = z.object({ managerId: uuid, kind: z.enum(["budget", "blocked"]), value: z.coerce.number().finite().min(0).max(1_000_000_000), reason: z.string().trim().min(5).max(300) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Montant positif et motif (5 caractères minimum) requis." };
  const db = createSupabaseAdminClient();
  const { data: finance } = await db.from("gamer_finances").select("budget,blocked_account").eq("gamer_id", parsed.data.managerId).maybeSingle();
  if (!finance) return { error: "Ce manager n’a pas encore de finances." };
  const current = Number(parsed.data.kind === "budget" ? finance.budget : finance.blocked_account);
  const delta = Math.round((parsed.data.value - current) * 100) / 100;
  if (delta === 0) return { error: "Le montant est identique." };
  const { error } = await db.rpc("admin_adjust_finance", { p_actor: actor.id, p_gamer: parsed.data.managerId, p_budget_delta: parsed.data.kind === "budget" ? delta : 0, p_blocked_delta: parsed.data.kind === "blocked" ? delta : 0, p_reason: parsed.data.reason });
  if (error) return { error: "Correction refusée (le montant ne peut pas devenir négatif)." };
  refresh(parsed.data.managerId);
  return { success: "Montant corrigé et tracé dans le journal financier." };
}

export async function resetCaptainCounter(_: AdminActionState, form: FormData): Promise<AdminActionState> {
  const actor = await requireAdmin();
  const parsed = z.object({ managerId: uuid, playerId: uuid }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Données invalides." };
  const db = createSupabaseAdminClient();
  const { data: squad } = await db.from("squads").select("id").eq("gamer_id", parsed.data.managerId).maybeSingle();
  if (!squad) return { error: "Ce manager n’a pas d’équipe." };
  const { data: seasonDays } = await db.from("matchdays").select("id,seasons!inner(status)").eq("seasons.status", "active");
  const ids = (seasonDays ?? []).map((day) => day.id);
  const { data: removed } = ids.length ? await db.from("captain_assignments").delete().eq("squad_id", squad.id).eq("player_id", parsed.data.playerId).in("matchday_id", ids).select("matchday_id") : { data: [] };
  await audit(actor.id, "manager.captain_counter.reset", "profile", parsed.data.managerId, { playerId: parsed.data.playerId }, { removed: removed?.length ?? 0 });
  refresh(parsed.data.managerId);
  return { success: "Compteur capitanat réinitialisé." };
}

export async function resetBonusCounter(_: AdminActionState, form: FormData): Promise<AdminActionState> {
  const actor = await requireAdmin();
  const parsed = z.object({ managerId: uuid, bonusId: z.enum(bonusIds) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Données invalides." };
  const db = createSupabaseAdminClient();
  const { data: squad } = await db.from("squads").select("id").eq("gamer_id", parsed.data.managerId).maybeSingle();
  if (!squad) return { error: "Ce manager n’a pas d’équipe." };
  const { data: season } = await db.from("seasons").select("id").eq("status", "active").maybeSingle();
  if (!season) return { error: "Aucune saison en cours." };
  const { data: removed } = await db.from("bonus_plays").delete().eq("squad_id", squad.id).eq("season_id", season.id).eq("bonus_id", parsed.data.bonusId).select("matchday_id,succeeded,bonus_amount");
  await audit(actor.id, "manager.bonus_counter.reset", "profile", parsed.data.managerId, { bonusId: parsed.data.bonusId }, { removed });
  refresh(parsed.data.managerId);
  return { success: "Compteur du bonus réinitialisé." };
}

export async function resendVerification(_: AdminActionState, form: FormData): Promise<AdminActionState> {
  const actor = await requireAdmin();
  const id = uuid.safeParse(form.get("managerId"));
  if (!id.success) return { error: "Manager invalide." };
  const db = createSupabaseAdminClient();
  const { data } = await db.auth.admin.getUserById(id.data);
  const email = data.user?.email;
  if (!email) return { error: "Adresse e-mail introuvable." };
  const { error } = await db.auth.resend({ type: "signup", email });
  if (error) return { error: "Envoi impossible (compte déjà vérifié ou limite d’envoi atteinte)." };
  await audit(actor.id, "manager.resend_verification", "profile", id.data, {});
  return { success: "E-mail de vérification renvoyé." };
}

export async function sendPasswordReset(_: AdminActionState, form: FormData): Promise<AdminActionState> {
  const actor = await requireAdmin();
  const id = uuid.safeParse(form.get("managerId"));
  if (!id.success) return { error: "Manager invalide." };
  const db = createSupabaseAdminClient();
  const { data } = await db.auth.admin.getUserById(id.data);
  const email = data.user?.email;
  if (!email) return { error: "Adresse e-mail introuvable." };
  const { error } = await db.auth.resetPasswordForEmail(email);
  if (error) return { error: "Envoi impossible pour le moment." };
  await audit(actor.id, "manager.password_reset", "profile", id.data, {});
  return { success: "E-mail de réinitialisation envoyé." };
}
