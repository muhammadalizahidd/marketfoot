import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/** `/profil` is the signed-in gamer's own profile; `?tab=espace` opens the private My Space settings. */
export default async function ProfileRedirect({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  if (tab === "espace") redirect("/mon-espace");
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");
  redirect(`/profil/${user.id}`);
}
