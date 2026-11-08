"use server";

import { SITE_FROZEN_MESSAGE, siteFrozenReason } from "@/lib/site-state";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
export type PredictionState = { error?: string; success?: string; choice?: string };
export async function savePrediction(_: PredictionState, form: FormData): Promise<PredictionState> {
  if (await siteFrozenReason()) return { error: SITE_FROZEN_MESSAGE };
  const input = z.object({matchId:z.string().uuid(),choice:z.enum(["1","N","2"])}).safeParse(Object.fromEntries(form));
  if (!input.success) return {error:"Choisissez 1, N ou 2."};
  const db = await createSupabaseServerClient();
  const {data:{user}}=await db.auth.getUser();
  if (!user) return {error:"Reconnectez-vous pour enregistrer votre pronostic."};
  const {error}=await db.rpc("save_prediction",{p_match_id:input.data.matchId,p_choice:input.data.choice});
  if (error) return {error:"Pronostic non enregistré. Le match a peut-être commencé ou a été reporté."};
  revalidatePath("/pronostics");
  return {success:"Pronostic enregistré",choice:input.data.choice};
}
