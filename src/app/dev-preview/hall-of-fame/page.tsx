import { notFound } from "next/navigation";

import { HallOfFame, type HofRecord } from "@/components/hall-of-fame/hall-of-fame";

const rows: HofRecord[] = [
  { rank: 1, name: "Zizou-mercato", period: "J18 - 22/23", amount: 4_720_000 },
  { rank: 2, name: "Petarmouillé", period: "J22 - 24/25", amount: 4_690_000 },
  { rank: 3, name: "Flo-Cash93", period: "J4 - 25/26", amount: 4_650_000 },
  { rank: 4, name: "Petarmouillé", period: "J22 - 24/25", amount: 4_450_000 },
  { rank: 5, name: "Trutlejkshuu…", period: "J22 - 24/25", amount: 4_430_000 },
  { rank: 6, name: "Jilou89", period: "J22 - 24/25", amount: 4_320_000 },
  { rank: 7, name: "Passedédela", period: "J22 - 24/25", amount: 4_290_000 },
  { rank: 8, name: "Kiffeur1893", period: "J22 - 24/25", amount: 4_250_000 },
  { rank: 9, name: "Palluuul", period: "J22 - 24/25", amount: 4_240_000 },
  { rank: 10, name: "OusmaneBO", period: "J22 - 24/25", amount: 4_210_000 },
  { rank: 124, name: "APE931301987", period: "J22 - 24/25", amount: 3_720_000, isMe: true },
];

/** Development-only fixture of the Figma "Hall Of Fame" frame (Banc tab active but heading "Record de gains", as drawn). */
export default function Preview() {
  if (process.env.NODE_ENV === "production") notFound();
  return <HallOfFame group="managers" category="banc" scope="day" records={rows} heading="Record de gains" text="Manager qui a remporté le + de gains grâce à ses titulaires" />;
}
