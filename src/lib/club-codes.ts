/** Standard three-letter Ligue 1 codes shown everywhere a club is named (PSG, MON, LIL...). Falls back to the first three letters. */
const codes: [string, string][] = [
  ["paris fc", "PFC"], ["paris saint", "PSG"], ["psg", "PSG"], ["monaco", "MON"], ["lille", "LIL"], ["losc", "LIL"], ["lens", "LEN"], ["toulouse", "TOU"],
  ["marseille", "MAR"], ["lyon", "LYO"], ["nice", "NIC"], ["rennes", "REN"], ["rennais", "REN"], ["strasbourg", "STR"], ["brest", "BRE"],
  ["nantes", "NAN"], ["auxerre", "AUX"], ["angers", "ANG"], ["havre", "HAC"], ["lorient", "LOR"], ["paris fc", "PFC"], ["troyes", "TRO"], ["mans", "LEM"],
];

export function clubCode(clubName?: string): string {
  if (!clubName) return "";
  const n = clubName.toLowerCase();
  for (const [key, code] of codes) if (n.includes(key)) return code;
  return clubName.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
}
