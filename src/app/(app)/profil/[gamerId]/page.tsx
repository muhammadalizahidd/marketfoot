import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getCurrentUserId } from "@/lib/auth/session";
import { getFriendCount, getFriends, getHonours, type FriendPeriod } from "@/data/repositories/gamer-repository";
import { getPerformance } from "@/data/repositories/performance-repository";
import { FriendsView } from "@/features/profile/friends-view";
import { HonoursView } from "@/features/profile/honours-view";
import { PerformanceView } from "@/features/profile/performance-view";
import { ProfileTabs, type ProfileTab } from "@/features/profile/profile-tabs";

export const metadata: Metadata = { title: "Profil" };
type Search = { tab?: string; season?: string; day?: string; period?: string; sort?: string; dir?: string };

export default async function GamerProfilePage({ params, searchParams }: { params: Promise<{ gamerId: string }>; searchParams: Promise<Search> }) {
  const { gamerId } = await params;
  const query = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(gamerId)) notFound();
  const viewer = await getCurrentUserId();
  const owner = viewer === gamerId;
  const tab: ProfileTab = (["performance", "palmares", "amis"] as const).find((item) => item === query.tab && (item !== "amis" || owner)) ?? "performance";
  const performance = await getPerformance(gamerId, query.season, Number(query.day) || undefined);
  if (!performance) notFound();
  const basePath = `/profil/${gamerId}`;
  const friendCount = owner ? await getFriendCount(gamerId) : undefined;

  let body;
  if (tab === "palmares") {
    body = <HonoursView honours={await getHonours(gamerId)} owner={owner} />;
  } else if (tab === "amis") {
    const period = (["first", "second", "day"] as const).find((item) => item === query.period) ?? "all";
    const day = Number(query.day) || performance.currentDay || 1;
    const friends = await getFriends(gamerId, query.season, period as FriendPeriod, day, query.sort, query.dir === "desc" ? "desc" : "asc");
    body = <FriendsView rows={friends.rows} period={period} sort={query.sort} dir={query.dir === "desc" ? "desc" : "asc"} basePath={basePath} day={day} />;
  } else {
    body = <PerformanceView data={performance} basePath={basePath} query={{ tab, season: query.season }} />;
  }
  return (
    <main className="app-page">
      <div className="gp">
        <ProfileTabs active={tab} basePath={basePath} seasonName={tab === "palmares" ? undefined : performance.seasonName} owner={owner} friends={friendCount} />
        {body}
      </div>
    </main>
  );
}
