"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getApplicationUrl } from "@/lib/supabase/env";
import { signInSchema, signUpSchema } from "@/lib/validation/auth";

export type AuthActionState = { error?: string; message?: string };

export async function signIn(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Vérifiez vos informations." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Adresse e-mail ou mot de passe incorrect." };
  // Administrators go straight to the admin portal.
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profile?.role === "admin") redirect("/admin");
  }
  redirect("/mon-equipe");
}

export async function signUp(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Vérifiez vos informations." };

  const supabase = await createSupabaseServerClient();
  const { headers } = await import("next/headers");
  const origin = getApplicationUrl((await headers()).get("origin"));
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { username: parsed.data.username }, emailRedirectTo: `${origin}/auth/callback?next=/onboarding` },
  });
  if (error) return { error: "Impossible de créer ce compte. Réessayez avec une autre adresse e-mail ou un autre pseudo." };
  return { message: "Compte créé. Vérifiez votre e-mail pour confirmer votre inscription." };
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/connexion");
}

export async function signInWithGoogle() {
  const supabase = await createSupabaseServerClient();
  const { headers } = await import("next/headers");
  const origin = getApplicationUrl((await headers()).get("origin"));
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${origin}/auth/callback?next=/onboarding` } });
  if (error || !data.url) redirect("/connexion?erreur=google");
  redirect(data.url);
}
