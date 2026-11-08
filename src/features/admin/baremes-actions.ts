"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/admin";
import { audit } from "@/lib/admin/audit";
import { ensureRulesSettings, restoreRulesVersion, saveRulesSettings } from "@/services/rules-settings";
import { rulesSettingsSchema, type RulesSettings } from "@/rules/settings";
import type { AdminActionState } from "./actions";

/** Which settings roots each Barèmes tab is allowed to change. */
const tabRoots: Record<string, string[]> = {
  general: ["budget", "transfers", "captain", "predictions", "bonus"],
  primes: ["primes", "teamResult"],
  palmares: ["honours"],
  parametres: ["schedule"],
};

function setPath(target: Record<string, unknown>, path: string, value: unknown) {
  const keys = path.split(".");
  let node: unknown = target;
  for (let i = 0; i < keys.length - 1; i++) {
    node = (node as Record<string, unknown>)[keys[i]];
    if (node === undefined || node === null || typeof node !== "object") throw new Error("Chemin inconnu.");
  }
  (node as Record<string, unknown>)[keys.at(-1)!] = value;
}

/**
 * Field naming: `a.b.0.c` sets a number; `pct:a.b` stores value / 100; `bool:a.b` stores true/false (hidden "false" first);
 * `str:a.b` stores text. Only roots allowed for the submitted tab are applied; disabled (structural) fields are never submitted.
 */
export async function saveBaremes(_: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const actor = await requireAdmin();
  const tab = String(formData.get("tab") ?? "");
  const roots = tabRoots[tab];
  if (!roots) return { error: "Onglet inconnu." };
  const { settings: current } = await ensureRulesSettings();
  const next = structuredClone(current) as unknown as Record<string, unknown>;
  try {
    for (const [rawKey, raw] of formData.entries()) {
      if (rawKey === "tab" || rawKey === "note" || typeof raw !== "string") continue;
      const [kind, path] = rawKey.includes(":") ? (rawKey.split(/:(.*)/s) as [string, string]) : ["num", rawKey];
      if (!roots.includes(path.split(".")[0])) continue;
      if (kind === "bool") setPath(next, path, raw === "true");
      else if (kind === "str") setPath(next, path, raw.trim());
      else {
        const value = Number(raw.replace(",", "."));
        if (!Number.isFinite(value)) return { error: "Un champ numérique est invalide." };
        setPath(next, path, kind === "pct" ? Math.round(value * 100) / 10000 : value);
      }
    }
  } catch {
    return { error: "Formulaire invalide, rechargez la page." };
  }
  const parsed = rulesSettingsSchema.safeParse(next);
  if (!parsed.success) return { error: "Valeurs hors limites : vérifiez les pourcentages, jours et montants." };
  const note = String(formData.get("note") ?? "").slice(0, 200) || `Modification de l’onglet ${tab}`;
  try {
    const version = await saveRulesSettings(parsed.data as RulesSettings, actor.id, note);
    await audit(actor.id, "rules.update", "rules_settings", null, { tab, version }, { version: undefined });
    revalidatePath("/admin/baremes"); revalidatePath("/admin/parametres");
    return { success: `Barèmes enregistrés (version ${version}).` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Enregistrement impossible." };
  }
}

export async function restoreBaremes(_: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const actor = await requireAdmin();
  const parsed = z.object({ version: z.coerce.number().int().positive() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Version invalide." };
  try {
    const version = await restoreRulesVersion(parsed.data.version, actor.id);
    await audit(actor.id, "rules.restore", "rules_settings", null, { restoredFrom: parsed.data.version, version });
    revalidatePath("/admin/baremes");
    return { success: `Version ${parsed.data.version} restaurée (nouvelle version ${version}).` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Restauration impossible." };
  }
}
