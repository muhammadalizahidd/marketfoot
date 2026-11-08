import { notFound, redirect } from "next/navigation";

/** Former generic resource lists now live in the dedicated screens. */
const destination: Record<string, string> = { seasons: "/admin/saison", clubs: "/admin/saison", players: "/admin/saison", matchdays: "/admin/saisie", fixtures: "/admin/saisie" };

export default async function LegacyResource({ params }: { params: Promise<{ resource: string }> }) {
  const target = destination[(await params).resource];
  if (!target) notFound();
  redirect(target);
}
