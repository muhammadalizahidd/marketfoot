import type { RuleResult } from "./types";
import { marketfootRulesConfig } from "./config";

export type InitialSquadPlayer = { id: string; position: "GK" | "DF" | "MF" | "FW"; clubId: string; value: number };

const requiredByPosition = marketfootRulesConfig.squad.positions;

export function validateInitialSquad(players: InitialSquadPlayer[], availableBudget: number): RuleResult<InitialSquadPlayer[]> {
  if (players.length !== marketfootRulesConfig.squad.size) return { ok: false, code: "SQUAD_SIZE", message: "Votre équipe doit contenir exactement 19 joueurs." };
  const total = players.reduce((sum, player) => sum + player.value, 0);
  if (total > availableBudget) return { ok: false, code: "BUDGET", message: "Le coût de votre équipe dépasse votre budget disponible." };
  for (const [position, required] of Object.entries(requiredByPosition) as Array<[keyof typeof requiredByPosition, number]>) {
    if (players.filter((player) => player.position === position).length !== required) return { ok: false, code: "POSITION", message: `Votre équipe doit comprendre ${required} ${position}.` };
  }
  if (Object.values(players.reduce<Record<string, number>>((counts, player) => ({ ...counts, [player.clubId]: (counts[player.clubId] ?? 0) + 1 }), {})).some((count) => count > marketfootRulesConfig.squad.maxPlayersPerClub)) return { ok: false, code: "CLUB_LIMIT", message: "Vous ne pouvez pas sélectionner plus de 4 joueurs du même club." };
  return { ok: true, value: players };
}

export function validateReplacementClubLimit(playersAfterReplacement: Array<{ clubId: string }>): RuleResult<true> {
  const counts = playersAfterReplacement.reduce<Record<string, number>>((current, player) => ({ ...current, [player.clubId]: (current[player.clubId] ?? 0) + 1 }), {});
  if (Object.values(counts).some((count) => count > marketfootRulesConfig.squad.maxPlayersPerClub)) return { ok: false, code: "CLUB_LIMIT", message: "Ce transfert dépasserait la limite de 4 joueurs du même club." };
  return { ok: true, value: true };
}
