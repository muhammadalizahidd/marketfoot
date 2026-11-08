import "server-only";

import { createHmac } from "node:crypto";
import { headers } from "next/headers";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServiceRoleKey } from "@/lib/supabase/env";

const FIVE_MINUTES = 5 * 60 * 1000;
const RETENTION_DAYS = 90;

/**
 * Throttled presence (feeds the admin "En ligne" counter) and linked-account detection (PRD §18, decision D3):
 * only a keyed hash of the sign-in address is stored, at most once per day, and purged after 90 days.
 */
export async function recordPresence(userId: string, lastSeenAt: string | null | undefined): Promise<void> {
  if (lastSeenAt && Date.now() - new Date(lastSeenAt).getTime() < FIVE_MINUTES) return;
  const db = createSupabaseAdminClient();
  await db.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", userId);
  const incoming = await headers();
  const ip = (incoming.get("x-forwarded-for")?.split(",")[0] ?? incoming.get("x-real-ip") ?? "").trim();
  if (!ip) return;
  const hash = createHmac("sha256", getSupabaseServiceRoleKey()).update(ip).digest("hex").slice(0, 32);
  const { data } = await db.from("profile_ip_events").select("id").eq("gamer_id", userId).eq("ip_hash", hash).gte("created_at", new Date(Date.now() - 86_400_000).toISOString()).limit(1);
  if (data?.length) return;
  await db.from("profile_ip_events").insert({ gamer_id: userId, ip_hash: hash });
  await db.from("profile_ip_events").delete().lt("created_at", new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString());
}
