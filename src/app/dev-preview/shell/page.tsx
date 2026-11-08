import { notFound } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";

/** Development-only visual harness: renders the shell with fixture data so it can be compared with Figma. */
export default function ShellPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <AppShell
      username="APE931301987"
      budget={2_100_000}
      lockedAccount={0}
      wealth={110_630_000}
      leaderboard={[
        { rank: 1, username: "Petarmouillé", wealth: 123_580_000, isMe: false },
        { rank: 1, username: "Trutlejdkks9…", wealth: 122_880_000, isMe: false },
        { rank: 1, username: "Jilou89", wealth: 122_460_000, isMe: false },
        { rank: 4, username: "APE931301987", wealth: 123_170_000, isMe: true },
        { rank: 5, username: "Oscarrrito", wealth: 120_870_000, isMe: false },
        { rank: 6, username: "Francas67", wealth: 120_120_000, isMe: false },
      ]}
    >
      <main className="app-page" style={{ minHeight: 700 }} />
    </AppShell>
  );
}
