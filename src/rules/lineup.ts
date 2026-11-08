import type { RuleResult } from "./types";
import { marketfootRulesConfig } from "./config";

export function validateLineup(starterIds: string[], captainId: string): RuleResult<{ starterIds: string[]; captainId: string }> {
  if (new Set(starterIds).size !== marketfootRulesConfig.squad.starters) return { ok: false, code: "STARTERS", message: "Vous devez sélectionner exactement 11 titulaires différents." };
  if (!starterIds.includes(captainId)) return { ok: false, code: "CAPTAIN", message: "Le capitaine doit faire partie des titulaires." };
  return { ok: true, value: { starterIds, captainId } };
}
