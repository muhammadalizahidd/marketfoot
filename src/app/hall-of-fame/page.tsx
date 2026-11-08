import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { HallOfFame, type HofCategory, type HofGroup, type HofScope } from "@/components/hall-of-fame/hall-of-fame";
import { getHallOfFame } from "@/data/repositories/hall-of-fame-repository";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Hall of Fame" };

const categories: Record<HofGroup, HofCategory[]> = { managers: ["perfs", "banc", "mercato"], joueurs: ["perfs", "achats", "ventes"] };

export default async function HallOfFamePage({ searchParams }: { searchParams: Promise<{ group?: string; category?: string; scope?: string }> }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");
  const query = await searchParams;
  const group: HofGroup = query.group === "joueurs" ? "joueurs" : "managers";
  const category = categories[group].find((item) => item === query.category) ?? "perfs";
  const scope: HofScope = query.scope === "season" ? "season" : "day";
  const records = await getHallOfFame(group, category, scope, user.id).catch(() => []);
  const emptyText = group === "managers" && category === "banc" ? "Les primes des remplaçants ne sont pas encore enregistrées : ce record apparaîtra dès qu’elles seront réglées avec la journée." : undefined;
  return <HallOfFame group={group} category={category} scope={scope} records={records} emptyText={emptyText} />;
}
