"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { usernameSchema } from "@/lib/validation/auth";
import { honoursBand, type HonoursCategory } from "@/rules";

export type ProfileActionState = { error?: string; message?: string; ok?: boolean };

async function currentUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");
  return { supabase, user };
}

/* ---------- Friends ---------- */
export async function addFriend(_: ProfileActionState, formData: FormData): Promise<ProfileActionState> {
  const parsed = z.string().trim().min(1, "Saisissez un pseudo.").max(32).safeParse(formData.get("username"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Saisissez un pseudo." };
  const { supabase, user } = await currentUser();
  const admin = createSupabaseAdminClient();
  const { data: target } = await admin.from("profiles").select("id,username").ilike("username", parsed.data.replace(/[%_]/g, "")).limit(5);
  const hit = (target ?? []).find((row) => row.username.toLowerCase() === parsed.data.toLowerCase());
  if (!hit) return { error: "Aucun manager ne porte ce pseudo." };
  if (hit.id === user.id) return { error: "Vous ne pouvez pas vous ajouter vous-même." };
  const { error } = await supabase.from("friendships").insert({ follower_id: user.id, followed_id: hit.id });
  if (error) return { error: error.code === "23505" ? "Ce manager est déjà dans vos amis." : "Impossible d’ajouter cet ami. Réessayez." };
  revalidatePath(`/profil/${user.id}`);
  return { ok: true, message: `${hit.username} a été ajouté à vos amis.` };
}

export async function removeFriend(formData: FormData): Promise<void> {
  const id = z.string().uuid().safeParse(formData.get("friendId"));
  if (!id.success) return;
  const { supabase, user } = await currentUser();
  await supabase.from("friendships").delete().eq("follower_id", user.id).eq("followed_id", id.data);
  revalidatePath(`/profil/${user.id}`);
}

/* ---------- Trophies ---------- */
export async function selectTrophy(formData: FormData): Promise<void> {
  const key = z.string().regex(/^[a-z_]+:\d+$/).safeParse(formData.get("key"));
  if (!key.success) return;
  const { user } = await currentUser();
  const admin = createSupabaseAdminClient();
  const [category, band] = key.data.split(":") as [HonoursCategory, string];
  const [{ data: rows }, { data: profile }] = await Promise.all([
    admin.from("gamer_honours").select("rank").eq("gamer_id", user.id).eq("category", category),
    admin.from("profiles").select("displayed_trophy").eq("id", user.id).maybeSingle(),
  ]);
  if (!(rows ?? []).some((row) => honoursBand(row.rank) === Number(band))) return; // only unlocked trophies can be displayed
  await admin.from("profiles").update({ displayed_trophy: profile?.displayed_trophy === key.data ? null : key.data }).eq("id", user.id);
  revalidatePath(`/profil/${user.id}`);
}

/* ---------- My Space ---------- */
const profileSchema = z.object({
  username: usernameSchema.optional(),
  favoriteClubId: z.union([z.string().uuid(), z.literal("")]).optional(),
  bio: z.string().trim().max(80, "80 caractères maximum.").optional(),
  country: z.string().trim().max(80).optional(),
});

export async function updateProfile(_: ProfileActionState, formData: FormData): Promise<ProfileActionState> {
  const parsed = profileSchema.safeParse(Object.fromEntries([...formData.entries()].filter(([, value]) => typeof value === "string")));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Vérifiez les informations saisies." };
  const { user } = await currentUser();
  const update: Record<string, unknown> = {};
  if (parsed.data.username !== undefined) update.username = parsed.data.username;
  if (parsed.data.favoriteClubId !== undefined) update.favorite_club_id = parsed.data.favoriteClubId || null;
  if (parsed.data.bio !== undefined) update.bio = parsed.data.bio || null;
  if (parsed.data.country !== undefined) update.country = parsed.data.country || null;
  if (!Object.keys(update).length) return {};
  const { error } = await createSupabaseAdminClient().from("profiles").update({ ...update, updated_at: new Date().toISOString() }).eq("id", user.id);
  if (error) return { error: error.code === "23505" ? "Ce pseudo est déjà utilisé." : "Impossible d’enregistrer. Réessayez." };
  revalidatePath("/profil");
  return { ok: true, message: "Enregistré" };
}

export async function checkUsername(value: string): Promise<{ available: boolean; message?: string }> {
  const parsed = usernameSchema.safeParse(value);
  if (!parsed.success) return { available: false, message: parsed.error.issues[0]?.message };
  const { user } = await currentUser();
  const { data } = await createSupabaseAdminClient().from("profiles").select("id").ilike("username", String(parsed.data).replace(/[%_]/g, "")).neq("id", user.id).limit(1);
  return { available: !data?.length };
}

const avatarTypes: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
export async function uploadAvatar(_: ProfileActionState, formData: FormData): Promise<ProfileActionState> {
  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) return { error: "Choisissez un fichier." };
  const extension = avatarTypes[file.type];
  if (!extension) return { error: "Format non pris en charge (PNG, JPEG ou WebP)." };
  if (file.size > 2 * 1024 * 1024) return { error: "L’image ne doit pas dépasser 2 Mo." };
  const { user } = await currentUser();
  const admin = createSupabaseAdminClient();
  const path = `${user.id}/${Date.now()}.${extension}`;
  const { error } = await admin.storage.from("avatars").upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: true });
  if (error) return { error: "Le téléversement a échoué. Réessayez." };
  const { data } = admin.storage.from("avatars").getPublicUrl(path);
  await admin.from("profiles").update({ avatar_url: data.publicUrl }).eq("id", user.id);
  revalidatePath("/profil");
  return { ok: true, message: "Photo mise à jour" };
}

export async function changePassword(_: ProfileActionState, formData: FormData): Promise<ProfileActionState> {
  const parsed = z.object({ password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères.").max(72), confirm: z.string() }).refine((v) => v.password === v.confirm, { message: "Les mots de passe ne correspondent pas.", path: ["confirm"] }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Vérifiez le mot de passe." };
  const { supabase } = await currentUser();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  return error ? { error: "Impossible de modifier le mot de passe. Reconnectez-vous puis réessayez." } : { ok: true, message: "Mot de passe modifié." };
}

export async function changeEmail(_: ProfileActionState, formData: FormData): Promise<ProfileActionState> {
  const parsed = z.string().trim().email("Saisissez une adresse e-mail valide.").safeParse(formData.get("email"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Adresse e-mail invalide." };
  const { supabase } = await currentUser();
  const { error } = await supabase.auth.updateUser({ email: parsed.data });
  return error ? { error: "Impossible de modifier l’adresse e-mail." } : { ok: true, message: "Un e-mail de confirmation vient d’être envoyé." };
}

export async function setTheme(formData: FormData): Promise<void> {
  const theme = z.enum(["light", "dark", "auto"]).safeParse(formData.get("theme"));
  if (!theme.success) return;
  const { user } = await currentUser();
  await createSupabaseAdminClient().from("profiles").update({ theme: theme.data }).eq("id", user.id);
  (await cookies()).set("mf-theme", theme.data, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/profil");
}

/**
 * Account deletion request: the account is deactivated (sign-in blocked, deletion date recorded) rather than erased,
 * because retention rules for ledgers and rankings are still open in the PRD (section 24).
 */
export async function requestDeletion(_: ProfileActionState, formData: FormData): Promise<ProfileActionState> {
  const { supabase, user } = await currentUser();
  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin.from("profiles").select("username").eq("id", user.id).maybeSingle();
  if (!profile || String(formData.get("confirm") ?? "").trim() !== profile.username) return { error: "Saisissez votre pseudo exactement pour confirmer." };
  await admin.from("profiles").update({ deletion_requested_at: new Date().toISOString() }).eq("id", user.id);
  await admin.auth.admin.updateUserById(user.id, { ban_duration: "876000h" });
  await supabase.auth.signOut();
  redirect("/connexion");
}
