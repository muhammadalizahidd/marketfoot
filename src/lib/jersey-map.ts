export const jerseyMap: Record<string, string> = {
  "angers": "angers-sco 1.png",
  "monaco": "as-monaco 1.png",
  "auxerre": "auxerre 1.png",
  "troyes": "estac-troyes 1.png",
  "estac": "estac-troyes 1.png",
  "lorient": "fc-lorient 1.png",
  "havre": "le-havre 1.png",
  "mans": "le-mans 1.png",
  "lille": "losc-lille 1.png",
  "losc": "losc-lille 1.png",
  "nice": "ogc-nice 1.png",
  "ogc": "ogc-nice 1.png",
  "lyon": "olympique-lyonnais 1.png",
  "olympique lyonnais": "olympique-lyonnais 1.png",
  "marseille": "olympique-marseille 1.png",
  "olympique de marseille": "olympique-marseille 1.png",
  "om": "olympique-marseille 1.png",
  "paris fc": "paris-fc 1.png",
  "pfc": "paris-fc 1.png",
  "paris saint": "paris-saint-germain 1.png",
  "psg": "paris-saint-germain 1.png",
  "lens": "rc-lens 1.png",
  "strasbourg": "rc-strasbourg 1.png",
  "brest": "stade-brestois 1.png",
  "rennes": "stade-rennais 1.png",
  "rennais": "stade-rennais 1.png",
  "rennias": "stade-rennais 1.png",
  "toulouse": "toulouse-fc 1.png",
  "nantes": "nantes.jpg",
  "default": "default.svg"
};

export function getJerseyImage(clubName?: string): string {
  if (!clubName) return "/images/jerseys/default.svg";
  
  const normalized = clubName.toLowerCase();
  
  for (const [key, filename] of Object.entries(jerseyMap)) {
    if (normalized.includes(key) && key !== "default") {
      return `/images/jerseys/${filename}`;
    }
  }
  
  return "/images/jerseys/default.svg";
}

/** Alpha-trimmed, 480px-wide version of a club shirt (used for the large artwork on the player profile). */
export function getJerseyTrimImage(clubName?: string): string {
  const full = getJerseyImage(clubName);
  if (full.endsWith(".svg")) return full;
  return full.replace("/images/jerseys/", "/images/jerseys-trim/").replace(/\.jpg$/, ".png");
}
