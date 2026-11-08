import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { defaultRulesSettings, mergeWithDefaults, rulesSettingsSchema, setRulesSettings, type RulesSettings } from "@/rules/settings";

export type RulesSettingsVersion = { id: string; version: number; note: string | null; isActive: boolean; createdAt: string; createdBy: string | null };

let cache: { at: number; version: number; settings: RulesSettings } | null = null;
const TTL_MS = 15_000;

/**
 * Loads the active Barèmes and installs them for the rule functions. Call it at the start of every server flow that
 * computes money (settlement, transfers, Mercato, onboarding). Falls back to the PRD reference values when none exist.
 */
export async function ensureRulesSettings(): Promise<{ version: number; settings: RulesSettings }> {
  if (cache && Date.now() - cache.at < TTL_MS) { setRulesSettings(cache.settings); return cache; }
  const { data } = await createSupabaseAdminClient().from("rules_settings").select("version,settings").eq("is_active", true).maybeSingle();
  const settings = data ? mergeWithDefaults(data.settings) : defaultRulesSettings;
  cache = { at: Date.now(), version: data?.version ?? 0, settings };
  setRulesSettings(settings);
  return cache;
}

export async function listRulesVersions(limit = 8): Promise<RulesSettingsVersion[]> {
  const { data } = await createSupabaseAdminClient().from("rules_settings").select("id,version,note,is_active,created_at,created_by").order("version", { ascending: false }).limit(limit);
  return (data ?? []).map((row) => ({ id: row.id, version: row.version, note: row.note, isActive: row.is_active, createdAt: row.created_at, createdBy: row.created_by }));
}

/** Stores a new active version (the previous one stays in the history). Returns the new version number. */
export async function saveRulesSettings(next: RulesSettings, actorId: string, note: string): Promise<number> {
  const parsed = rulesSettingsSchema.parse(next);
  const db = createSupabaseAdminClient();
  const { data: latest } = await db.from("rules_settings").select("version").order("version", { ascending: false }).limit(1).maybeSingle();
  const version = (latest?.version ?? 0) + 1;
  const { error: offError } = await db.from("rules_settings").update({ is_active: false }).eq("is_active", true);
  if (offError) throw new Error("Impossible de désactiver la version précédente.");
  const { error } = await db.from("rules_settings").insert({ version, settings: parsed, note, is_active: true, created_by: actorId });
  if (error) throw new Error("Impossible d’enregistrer les barèmes.");
  cache = null;
  return version;
}

/** Re-activates an older version as a new version (history is never rewritten). */
export async function restoreRulesVersion(version: number, actorId: string): Promise<number> {
  const { data } = await createSupabaseAdminClient().from("rules_settings").select("settings").eq("version", version).maybeSingle();
  if (!data) throw new Error("Version introuvable.");
  return saveRulesSettings(mergeWithDefaults(data.settings), actorId, `Restauration de la version ${version}`);
}
