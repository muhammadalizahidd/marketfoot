import { ensureRulesSettings } from "@/services/rules-settings";
import { TeamBuilder } from "@/features/onboarding/team-builder";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { calculateInitialBudget } from "@/rules";
import { UsernameSetup } from "@/features/onboarding/username-setup";

export default async function OnboardingPage() {
  await ensureRulesSettings();
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: players }, { data: catalogue }, { count: settledMatchdays }, { data: profile }] = await Promise.all([
    supabase.from("players").select("id, first_name, last_name, position, marketfoot_value, clubs(name)").eq("is_active", true).order("last_name"),
    supabase.from("players").select("marketfoot_value").eq("is_active", true),
    supabase.from("matchdays").select("id", { count: "exact", head: true }).eq("status", "settled"),
    user ? supabase.from("profiles").select("username").eq("id", user.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const average = catalogue?.length ? catalogue.reduce((sum, player) => sum + Number(player.marketfoot_value), 0) / catalogue.length : 0;
  const budget = catalogue?.length ? calculateInitialBudget(average, settledMatchdays ?? 0) : 0;
  if (!user) redirect("/connexion");
  if (!profile?.username || profile.username.startsWith("gamer-")) return <main className="app-page"><UsernameSetup/></main>;
  return <main className="app-page"><TeamBuilder players={players ?? []} budget={budget} /></main>;
}
