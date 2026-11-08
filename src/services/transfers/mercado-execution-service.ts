import "server-only";
import { ensureRulesSettings } from "@/services/rules-settings";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { calculateMercadoDemandDelta } from "@/rules";
import { one } from "@/lib/supabase/relation";
import { moneyRatio, moneySum, cents } from "@/rules/money";

export type MercadoReview = { matchdayId: string; orders: Array<{ orderId: string; squadName: string; soldName: string; boughtName: string; outcome: "executed" | "rejected"; reason?: string; budgetDelta: number }>; values: Array<{ playerId: string; delta: number; purchases: number; sales: number; beforeValue: number }> };

export async function buildMercadoReview(matchdayId: string): Promise<MercadoReview> {
  await ensureRulesSettings();
  const admin = createSupabaseAdminClient();
  const [{ data: matchday }, { data: orders }] = await Promise.all([
    admin.from("matchdays").select("id,status").eq("id", matchdayId).single(),
    admin.from("mercado_orders").select("id,squad_id,sold_player_id,bought_player_id,submitted_sold_value,submitted_bought_value,submitted_tax,fixed_commission,created_at,squads(name,gamer_id),sold:players!mercado_orders_sold_player_id_fkey(first_name,last_name),bought:players!mercado_orders_bought_player_id_fkey(first_name,last_name)").eq("matchday_id", matchdayId).eq("status", "pending").order("created_at").order("id"),
  ]);
  if (!matchday || matchday.status !== "mercado") throw new Error("La journée n’est pas dans la phase Mercado.");
  const playerIds = [...new Set((orders??[]).flatMap(o=>[o.sold_player_id,o.bought_player_id]))];
  const squadIds = [...new Set((orders??[]).map(o=>o.squad_id))];
  const [{data:players,error:playerError},{data:members,error:memberError}] = await Promise.all([
    playerIds.length?admin.from("players").select("id,marketfoot_value").in("id",playerIds):Promise.resolve({data:[],error:null}),
    squadIds.length?admin.from("squad_members").select("squad_id,player_id,is_initial").in("squad_id",squadIds):Promise.resolve({data:[],error:null}),
  ]);
  if(playerError||memberError) throw new Error("Les valeurs de clôture ne sont pas disponibles.");
  const before = new Map((players??[]).map(p=>[p.id,Number(p.marketfoot_value)]));
  const buyCount = new Map<string, number>(); const sellCount = new Map<string, number>();
  for(const order of orders??[]) {
    const member=members?.find(m=>m.squad_id===order.squad_id&&m.player_id===order.sold_player_id);
    if(!member) throw new Error("Un joueur à vendre n’est plus détenu. Corrigez le carnet avant l’exécution.");
    buyCount.set(order.bought_player_id,(buyCount.get(order.bought_player_id)??0)+1);
    if(!member.is_initial) sellCount.set(order.sold_player_id,(sellCount.get(order.sold_player_id)??0)+1);
  }
  const values = playerIds.map(playerId=>({playerId,purchases:buyCount.get(playerId)??0,sales:sellCount.get(playerId)??0,beforeValue:before.get(playerId)??0,delta:calculateMercadoDemandDelta(buyCount.get(playerId)??0,sellCount.get(playerId)??0)}));
  const closing=new Map(values.map(p=>[p.playerId,Math.max(500000,p.beforeValue+p.delta)]));
  const reviewOrders=(orders??[]).map(order=>{
    const bought=closing.get(order.bought_player_id)!;const sold=closing.get(order.sold_player_id)!;
    const tax=moneyRatio(bought,Number(cents(Number(order.submitted_tax))),Number(cents(Number(order.submitted_bought_value))));
    return {orderId:order.id,squadName:one(order.squads)?.name??"Équipe",soldName:`${one(order.sold)?.first_name??""} ${one(order.sold)?.last_name??""}`,boughtName:`${one(order.bought)?.first_name??""} ${one(order.bought)?.last_name??""}`,outcome:"executed" as const,budgetDelta:moneySum(sold,-bought,-tax,-Number(order.fixed_commission))};
  });
  return { matchdayId, orders:reviewOrders, values };
}

export async function executeMercado(actorId: string, matchdayId: string) {
  await ensureRulesSettings();
  const review = await buildMercadoReview(matchdayId);
  const { error } = await createSupabaseAdminClient().rpc("commit_mercado_run", { p_actor_id: actorId, p_matchday_id: matchdayId, p_orders: review.orders.map((order) => ({ orderId: order.orderId, outcome: order.outcome, reason: order.reason })), p_value_changes: review.values });
  if (error) throw new Error("L’exécution atomique du Mercado a échoué.");
  return review;
}
