import { notFound } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { LineupManager } from "@/features/squad/lineup-manager";
import { members, sidebarFixture } from "../_fixtures";

/** Development-only fixture of the Figma "Team Page - Captain choice" frame (no data access, no saving). */
export default function Preview() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <AppShell {...sidebarFixture}>
      <main className="app-page" style={{ minHeight: 0 }}>
        <LineupManager members={members.map((m, i) => ({ ...m, captainUses: i === 1 ? 4 : 3, isCaptain: i === 1 }))} matchdayId={null} activeTab="capitaine" />
      </main>
    </AppShell>
  );
}
