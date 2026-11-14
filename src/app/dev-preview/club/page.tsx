import { notFound } from "next/navigation";

import { ClubProfile, type ClubFixture, type ClubPlayerRow } from "@/components/club/club-profile";
import { AppShell } from "@/components/layout/app-shell";
import { sidebarFixture } from "../_fixtures";

const p = (id: string, name: string, position: string, order: number, matches: number, starters: number, goals: number, ownGoals: number, assists: number, penalties: number, yellow: number, red: number, value: number): ClubPlayerRow =>
  ({ id, name, position, order, matches, starters, goals, ownGoals, assists, penalties, penaltiesMissed: 0, yellow, red, value });
const field = (id: string, name: string, position: string, order: number) => p(id, name, position, order, 22, 17, 12, 12, 7, 4, 1, 0, 11_540_000);
const rows: ClubPlayerRow[] = [
  p("1", "M. Safonov", "G", 0, 22, 17, 0, 0, 1, 4, 0, 28, 14_850_000),
  p("2", "L. Chevalier", "G", 0, 1, 1, 0, 0, 0, 0, 0, 2, 7_480_000),
  field("3", "Marquinhos", "D", 1), field("4", "W. Pacho", "D", 1), field("5", "N. Mendes", "D", 1), field("6", "A. Hakimi", "D", 1),
  field("7", "Vitinha", "M", 2), field("8", "J. Neves", "M", 2), field("9", "F. Ruiz", "M", 2),
  field("10", "K. Kvaratskhelia", "A", 3), field("11", "O. Dembélé", "A", 3), field("12", "F. Torres", "A", 3),
];
const f = (id: string, day: number, date: string, home: [string, number | null], away: [string, number | null]): ClubFixture =>
  ({ id, matchdayId: id, day, kickoff: date, home: { id: home[0], name: home[0], score: home[1] }, away: { id: away[0], name: away[0], score: away[1] }, postponed: false });
const fixtures: ClubFixture[] = [
  f("a1", 1, "2026-08-15T18:45:00Z", ["Lorient", 1], ["Lens", 2]), f("a2", 2, "2026-08-31T18:45:00Z", ["Lens", 2], ["Toulouse", 2]), f("a3", 3, "2026-09-06T18:45:00Z", ["Auxerre", 1], ["Lens", 3]),
  f("a4", 4, "2026-09-20T18:45:00Z", ["Lens", 2], ["Strasbourg", 1]), f("a5", 5, "2026-09-13T18:45:00Z", ["Lille", 2], ["Lens", 2]), f("a6", 6, "2026-08-15T18:45:00Z", ["Lorient", 1], ["Lens", 2]),
  f("b1", 5, "2026-09-13T18:45:00Z", ["Lille", 2], ["Lens", 2]), f("b2", 4, "2026-09-20T18:45:00Z", ["Lens", 2], ["Strasbourg", 1]), f("b3", 3, "2026-09-06T18:45:00Z", ["Auxerre", 1], ["Lens", 3]),
  f("b4", 2, "2026-08-31T18:45:00Z", ["Lens", 2], ["Toulouse", 2]), f("b5", 1, "2026-08-15T18:45:00Z", ["Lorient", 1], ["Lens", 2]), f("b6", 1, "2026-08-15T18:45:00Z", ["Lorient", 1], ["Lens", 2]),
  f("c1", 5, "2026-09-13T18:45:00Z", ["Lille", 2], ["Lens", 2]), f("c2", 4, "2026-09-20T18:45:00Z", ["Lens", 2], ["Strasbourg", 1]), f("c3", 3, "2026-09-06T18:45:00Z", ["Auxerre", 1], ["Lens", 3]),
  f("c4", 2, "2026-08-31T18:45:00Z", ["Lens", null], ["Toulouse", null]), f("c5", 1, "2026-08-15T18:45:00Z", ["Lorient", null], ["Lens", null]), f("c6", 1, "2026-08-15T18:45:00Z", ["Lorient", null], ["Lens", null]),
];

/** Development-only fixture of the Figma "Team Form" frame (real football club profile). */
export default function Preview() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <AppShell {...sidebarFixture}>
      <main className="app-page" style={{ minHeight: 0 }}>
        <ClubProfile clubId="preview" clubName="Paris Saint-Germain" rows={rows} fixtures={fixtures} basePath="/dev-preview/club" />
      </main>
    </AppShell>
  );
}
