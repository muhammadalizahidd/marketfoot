import { notFound } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { LineupManager } from "@/features/squad/lineup-manager";
import { members, sidebarFixture } from "../_fixtures";

/** Development-only fixture of the Figma "Team Page - Composition" frame (no data access, no saving). */
export default function Preview() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <AppShell {...sidebarFixture}>
      <main className="app-page" style={{ minHeight: 0 }}>
        <LineupManager members={members} matchdayId={null} activeTab="composition" />
      </main>
    </AppShell>
  );
}
