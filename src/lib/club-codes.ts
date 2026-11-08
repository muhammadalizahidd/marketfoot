/** Short club codes shown next to player names (PSG, ASM, LOSC...). Falls back to the first three letters. */
const codes: [string, string][] = [
  ["paris saint", "PSG"], ["psg", "PSG"], ["monaco", "ASM"], ["lille", "LOSC"], ["losc", "LOSC"], ["lens", "RCL"], ["toulouse", "TFC"],
  ["marseille", "OM"], ["lyon", "OL"], ["nice", "OGCN"], ["rennes", "SRFC"], ["rennais", "SRFC"], ["strasbourg", "RCSA"], ["brest", "SB29"],
  ["nantes", "FCN"], ["auxerre", "AJA"], ["angers", "SCO"], ["havre", "HAC"], ["lorient", "FCL"], ["paris fc", "PFC"], ["troyes", "ESTAC"], ["mans", "MANS"],
];

export function clubCode(clubName?: string): string {
  if (!clubName) return "";
  const n = clubName.toLowerCase();
  for (const [key, code] of codes) if (n.includes(key)) return code;
  return clubName.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
}
