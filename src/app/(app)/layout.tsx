import { trophyImage } from "@/rules/honours";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AppShell, type SidebarRankingRow } from "@/components/layout/app-shell";
import { getLatestRankings } from "@/data/repositories/ranking-repository";
import { getTopMovers } from "@/data/repositories/players-repository";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { recordPresence } from "@/lib/presence";
import { SITE_FROZEN_MESSAGE, siteFrozenReason } from "@/lib/site-state";

/** Top three plus the signed-in gamer and the next two, as shown in the Figma sidebar card. */
function sidebarWindow(rows: Awaited<ReturnType<typeof getLatestRankings>>, userId: string): SidebarRankingRow[] {
  const toRow = (row: (typeof rows)[number]): SidebarRankingRow => ({ rank: row.rank, username: row.username, wealth: row.totalWealth, isMe: row.gamerId === userId });
  const meIndex = rows.findIndex((row) => row.gamerId === userId);
  const picked = new Set<number>([0, 1, 2]);
  if (meIndex >= 0) [meIndex, meIndex + 1, meIndex + 2].forEach((index) => picked.add(index));
  return [...picked].filter((index) => index < rows.length).sort((a, b) => a - b).slice(0, 6).map((index) => toRow(rows[index]));
}

export default async function ApplicationLayout({ children }: Readonly<{ children: ReactNode }>) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");
  const [{ data: profile }, { data: finances }, { data: ranking }, rankings, movers] = await Promise.all([
    supabase.from("profiles").select("username,avatar_url,banned_at,last_seen_at,displayed_trophy").eq("id", user.id).maybeSingle(),
    supabase.from("gamer_finances").select("budget,blocked_account").eq("gamer_id", user.id).maybeSingle(),
    supabase.from("ranking_snapshots").select("general_rank,total_wealth").eq("gamer_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    getLatestRankings().catch(() => []),
    getTopMovers().catch(() => ({ buys: [], sells: [] })),
  ]);
  // A banned manager is signed out at once (the auth ban also blocks the next token refresh).
  if (profile?.banned_at) { await supabase.auth.signOut(); redirect("/connexion?banned=1"); }
  await recordPresence(user.id, profile?.last_seen_at).catch(() => undefined);
  const frozen = await siteFrozenReason().catch(() => null);

  return (
    <AppShell
      username={profile?.username ?? user.email ?? "Mon compte"}
      budget={Number(finances?.budget ?? 0)}
      lockedAccount={Number(finances?.blocked_account ?? 0)}
      rank={ranking?.general_rank}
      wealth={ranking ? Number(ranking.total_wealth) : undefined}
      leaderboard={sidebarWindow(rankings, user.id)}
      topBuys={movers.buys}
      topSells={movers.sells}
      avatarUrl={profile?.avatar_url}
      trophyImage={trophyImage(profile?.displayed_trophy)}
      userId={user.id}
    >
      {frozen && <div className="site-freeze-banner" role="status"><b>Site gelé.</b> {SITE_FROZEN_MESSAGE}</div>}
      {children}
    </AppShell>
  );
}
