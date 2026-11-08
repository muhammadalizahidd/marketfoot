import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function getLeagueData(seasonId?: string, dayId?: string) {
  const db = createSupabaseAdminClient();
  const { data: seasons, error } = await db.from("seasons").select("id,name,is_current").order("starts_on", { ascending: false });
  if (error) throw new Error("Le championnat est indisponible. Réessayez.");
  const season = seasons?.find(s => s.id === seasonId) ?? seasons?.find(s => s.is_current) ?? seasons?.[0];
  const { data: days } = season ? await db.from("matchdays").select("id,number,status").eq("season_id",season.id).order("number") : { data: [] };
  const day = days?.find(d => d.id === dayId) ?? days?.find(d => ["open","mercado","closed"].includes(d.status)) ?? days?.at(-1);
  const [{ data: clubs }, { data: matches, error: matchError }] = await Promise.all([
    db.from("clubs").select("id,name,short_name").order("name"),
    days?.length ? db.from("matches").select("id,matchday_id,home_club_id,away_club_id,home_score,away_score,is_postponed,kickoff_at").in("matchday_id",days.map(d=>d.id)).order("kickoff_at") : Promise.resolve({data: [],error:null}),
  ]);
  if (matchError) throw new Error("Impossible de charger les rencontres.");
  return { seasons:seasons??[], season, days:days??[],day,clubs:clubs??[],matches:matches??[] };
}
