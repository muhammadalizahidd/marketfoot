import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ClubProfile, type ClubSort } from "@/components/club/club-profile";
import { getClubProfile } from "@/data/repositories/club-repository";

export const metadata: Metadata = { title: "Club" };
const sorts: ClubSort[] = ["matches", "starters", "goals", "ownGoals", "assists", "penalties", "yellow", "red", "value"];

export default async function ClubPage({ params, searchParams }: { params: Promise<{ clubId: string }>; searchParams: Promise<{ sort?: string; all?: string }> }) {
  const { clubId } = await params;
  const query = await searchParams;
  const data = await getClubProfile(clubId);
  if (!data) notFound();
  const sort = sorts.find((item) => item === query.sort);
  return <main className="app-page"><ClubProfile clubId={clubId} clubName={data.club.name} rows={data.rows} fixtures={data.fixtures} sort={sort} showAll={query.all === "1"} /></main>;
}
