"use server";

import { SITE_FROZEN_MESSAGE, siteFrozenReason } from "@/lib/site-state";

import { revalidatePath } from "next/cache";
import { one } from "@/lib/supabase/relation";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validateReplacementClubLimit } from "@/rules";
import { completeDirectTransfer } from "@/services/transfers/direct-transfer-service";
import { submitMercadoOrder } from "@/services/transfers/mercado-order-service";

export type TransferActionState = { error?: string; success?: string };
const schema = z.object({ soldPlayerId: z.string().uuid(), boughtPlayerId: z.string().uuid() });

export async function cancelMercadoTransfer(_: TransferActionState, formData: FormData): Promise<TransferActionState> {
  if (await siteFrozenReason()) return { error: SITE_FROZEN_MESSAGE };
  const id = z.string().uuid().safeParse(formData.get("orderId"));
  if (!id.success) return { error: "Ordre invalide." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("cancel_mercado_order", { p_order: id.data });
  if (error) return { error: "Cet ordre ne peut plus être annulé. Actualisez la page pour vérifier son état." };
  revalidatePath("/transferts");
  return { success: "Ordre annulé." };
}

async function loadTransferContext(formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success || parsed.data.soldPlayerId === parsed.data.boughtPlayerId) return { error: "Sélectionnez un joueur à vendre et un autre à acheter." } as const;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Votre session a expiré." } as const;
  const [{ data: squad }, { data: finance }, { data: matchday }, { data: players }] = await Promise.all([
    supabase.from("squads").select("id, squad_members(player_id, players(id, club_id, marketfoot_value))").eq("gamer_id", user.id).maybeSingle(),
    supabase.from("gamer_finances").select("budget").eq("gamer_id", user.id).maybeSingle(),
    supabase.from("matchdays").select("id, number, status").in("status", ["open", "mercado"]).order("number").limit(1).maybeSingle(),
    supabase.from("players").select("id, club_id, position, marketfoot_value").in("id", [parsed.data.soldPlayerId, parsed.data.boughtPlayerId]).eq("is_active", true),
  ]);
  if (!squad || !finance || !matchday || !players || players.length !== 2) return { error: "Le transfert ne peut pas être préparé avec les données actuelles." } as const;
  const owned = squad.squad_members.find((member) => member.player_id === parsed.data.soldPlayerId);
  if (!owned) return { error: "Le joueur à vendre ne fait pas partie de votre équipe." } as const;
  if (squad.squad_members.some((member) => member.player_id === parsed.data.boughtPlayerId)) return { error: "Vous possédez déjà ce joueur." } as const;
  const sold = players.find((player) => player.id === parsed.data.soldPlayerId);
  const bought = players.find((player) => player.id === parsed.data.boughtPlayerId);
  if (!sold || !bought) return { error: "Un joueur sélectionné n’est plus disponible." } as const;
  if (sold.position !== bought.position) return { error: "Un transfert doit remplacer un joueur par un joueur du même poste." } as const;
  const clubCheck = validateReplacementClubLimit([...squad.squad_members.filter((member) => member.player_id !== sold.id).map((member) => ({ clubId: one(member.players)?.club_id ?? "" })), { clubId: bought.club_id }]);
  if (!clubCheck.ok) return { error: clubCheck.message } as const;
  return { user, squad, finance, matchday, sold, bought } as const;
}

export async function submitDirectTransfer(_: TransferActionState, formData: FormData): Promise<TransferActionState> {
  if (await siteFrozenReason()) return { error: SITE_FROZEN_MESSAGE };
  const context = await loadTransferContext(formData);
  if ("error" in context) return context;
  if (context.matchday.status !== "open") return { error: "Les transferts directs ne sont possibles que pendant la période ouverte." };
  const supabase = await createSupabaseServerClient();
  const { count } = await supabase.from("direct_transfers").select("id", { count: "exact", head: true }).eq("squad_id", context.squad.id).eq("matchday_id", context.matchday.id).eq("status", "completed");
  const result = await completeDirectTransfer({ gamerId: context.user.id, matchdayId: context.matchday.id, matchdayNumber: context.matchday.number, soldPlayerId: context.sold.id, boughtPlayerId: context.bought.id, soldValue: Number(context.sold.marketfoot_value), boughtValue: Number(context.bought.marketfoot_value), budget: Number(context.finance.budget), transfersAlreadyMade: count ?? 0 });
  if (!result.ok) return { error: result.message };
  revalidatePath("/mon-equipe"); revalidatePath("/transferts");
  return { success: `Transfert effectué. Taxe : ${new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(result.value.tax)}.` };
}

export async function submitMercadoTransfer(_: TransferActionState, formData: FormData): Promise<TransferActionState> {
  if (await siteFrozenReason()) return { error: SITE_FROZEN_MESSAGE };
  const context = await loadTransferContext(formData);
  if ("error" in context) return context;
  if (context.matchday.status !== "mercado") return { error: "Les ordres Mercado sont possibles uniquement pendant la fenêtre Mercado." };
  const supabase = await createSupabaseServerClient();
  const { count } = await supabase.from("mercado_orders").select("id", { count: "exact", head: true }).eq("squad_id", context.squad.id).eq("matchday_id", context.matchday.id).eq("status", "pending");
  const result = await submitMercadoOrder({ squadId: context.squad.id, matchdayId: context.matchday.id, matchdayNumber: context.matchday.number, soldPlayerId: context.sold.id, boughtPlayerId: context.bought.id, soldValue: Number(context.sold.marketfoot_value), boughtValue: Number(context.bought.marketfoot_value), availableMercadoBudget: Number(context.finance.budget), transfersAlreadyMade: count ?? 0 });
  if (!result.ok) return { error: result.message };
  revalidatePath("/transferts");
  return { success: "Ordre Mercado enregistré. Il sera exécuté à la fermeture de la fenêtre." };
}
