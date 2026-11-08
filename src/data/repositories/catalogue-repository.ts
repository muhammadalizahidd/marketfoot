import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { one } from "@/lib/supabase/relation";

export type CatalogueFilters = { q?: string; position?: string; club?: string; view?: "general" | "performance"; page?: number; sort?:string; max?:number };

export async function getPlayerCatalogueDetail(playerId?: string) {
  if (!playerId) return null;
  const supabase = createSupabaseAdminClient();
  const [{ data: player }, { data: stats }, { data: history }] = await Promise.all([
    supabase.from("players").select("id,first_name,last_name,position,marketfoot_value,real_value,clubs(name,short_name)").eq("id", playerId).maybeSingle(),
    supabase.from("player_match_stats").select("minutes_played,goals,assists,penalties_scored,yellow_cards,red_cards,saves,started").eq("player_id", playerId),
    supabase.from("player_value_history").select("previous_value,next_value,reason,created_at").eq("player_id", playerId).eq("value_kind", "marketfoot_value").order("created_at", { ascending: false }).limit(8),
  ]);
  if (!player) return null;
  const totals = (stats ?? []).reduce((current, stat) => ({
    matches: current.matches + (stat.minutes_played > 0 ? 1 : 0), starters: current.starters + (stat.started ? 1 : 0), goals: current.goals + stat.goals, assists: current.assists + stat.assists, penalties: current.penalties + stat.penalties_scored, yellow: current.yellow + stat.yellow_cards, red: current.red + stat.red_cards, saves: current.saves + stat.saves,
  }), { matches: 0, starters: 0, goals: 0, assists: 0, penalties: 0, yellow: 0, red: 0, saves: 0 });
  return { ...player, club: one(player.clubs)?.name ?? "—", value: Number(player.marketfoot_value), realValue: Number(player.real_value), totals, history: (history ?? []).map((item) => ({ ...item, previousValue: Number(item.previous_value), nextValue: Number(item.next_value) })) };
}

export async function getPlayerCatalogue(filters: CatalogueFilters) {
  const db=createSupabaseAdminClient();
  const pageSize=20;
  let page=Number.isFinite(filters.page)?Math.max(1,Math.floor(filters.page!)):1;
  let query=db.from("player_catalogue").select("*",{count:"exact"}).eq("is_active",true);
  const search=filters.q?.trim().replace(/[%_,().]/g," ").slice(0,80);
  if(search) query=query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%`);
  if(filters.position&&["GK","DF","MF","FW"].includes(filters.position)) query=query.eq("position",filters.position);
  if(filters.club&&/^[0-9a-f-]{36}$/i.test(filters.club)) query=query.eq("club_id",filters.club);
  if(filters.max&&Number.isFinite(filters.max)) query=query.lte("marketfoot_value",filters.max);
  query=query.order(filters.sort==="name"?"last_name":"marketfoot_value",{ascending:filters.sort==="asc"||filters.sort==="name"}).order("id");
  let response=await query.range((page-1)*pageSize,page*pageSize-1);
  if(response.error) throw new Error("Le catalogue est indisponible. Réessayez.");
  const total=response.count??0;
  const last=Math.max(1,Math.ceil(total/pageSize));
  if(page>last){page=last;response=await query.range((page-1)*pageSize,page*pageSize-1);}
  if(response.error) throw new Error("Le catalogue est indisponible.");
  const {data:clubs,error}=await db.from("clubs").select("id,name").order("name");
  if(error) throw new Error("Les clubs sont indisponibles.");
  return {rows:(response.data??[]).map(p=>({...p,value:Number(p.marketfoot_value),initialValue:Number(p.initial_value),holders:Number(p.holders),earnings:Number(p.earnings),netDemand:Number(p.last_net_demand),stats:{goals:Number(p.goals),assists:Number(p.assists),penalties:Number(p.penalties),yellow:Number(p.yellow),red:Number(p.red),saves:Number(p.saves),matches:Number(p.matches),starters:Number(p.starters),cleanSheets:Number(p.clean_sheets)}})),total,page,pageSize,clubs:clubs??[]};
}
