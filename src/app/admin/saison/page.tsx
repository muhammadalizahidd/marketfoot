import Link from "next/link";
import { Eye, Upload } from "lucide-react";

import { AutoSubmitForm, ConfirmAction } from "@/components/admin/client";
import { Chip, PageHeader, TableFooter, href, pageParam } from "@/components/admin/ui";
import { statusLabels } from "@/lib/admin/season-status";
import { formatDate } from "@/lib/admin/format";
import { getJerseyImage } from "@/lib/jersey-map";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { deleteSeason } from "@/features/admin/season-actions";
import { SeasonCreateModal } from "@/features/admin/season-create-modal";

const PER_PAGE = 10;

export default async function SeasonsPage({ searchParams }: { searchParams: Promise<{ q?: string; start?: string; status?: string; page?: string }> }) {
  const query = await searchParams;
  const page = pageParam(query.page);
  const db = createSupabaseAdminClient();
  let request = db.from("seasons").select("id,name,status,starts_on,ends_on", { count: "exact" }).order("starts_on", { ascending: false });
  if (query.q?.trim()) request = request.ilike("name", `%${query.q.trim().replace(/[%,]/g, "")}%`);
  if (query.start && /^\d{4}-\d{2}-\d{2}$/.test(query.start)) request = request.gte("starts_on", query.start);
  if (query.status && statusLabels[query.status]) request = request.eq("status", query.status);
  const [{ data: seasons, count }, { data: stats }, { data: clubs }, { data: allSeasons }, { data: links }] = await Promise.all([
    request.range((page - 1) * PER_PAGE, page * PER_PAGE - 1),
    db.rpc("admin_season_stats"),
    db.from("clubs").select("id,name,crest_url").order("name"),
    db.from("seasons").select("id,name").order("starts_on", { ascending: false }),
    db.from("season_clubs").select("season_id,club_id"),
  ]);
  type SeasonStat = { season_id: string; teams: number; users: number };
  const byId = new Map(((stats ?? []) as SeasonStat[]).map((row) => [row.season_id, row] as const));
  const options = (allSeasons ?? []).map((season) => ({ id: season.id, name: season.name, clubIds: (links ?? []).filter((link) => link.season_id === season.id).map((link) => link.club_id) }));
  const year = new Date().getFullYear();
  const params = { q: query.q, start: query.start, status: query.status };

  return (
    <main>
      <PageHeader title="Saison" actions={<SeasonCreateModal seasons={options} clubs={(clubs ?? []).map((club) => ({ id: club.id, name: club.name, icon: club.crest_url ?? getJerseyImage(club.name) }))} defaultStart={`${year}-08-01`} defaultEnd={`${year + 1}-06-01`} />} />
      <AutoSubmitForm>
        <input className="ad-input ad-input--search" name="q" defaultValue={query.q} placeholder="Rechercher" aria-label="Rechercher une saison" />
        <input className="ad-input" type="date" name="start" defaultValue={query.start} aria-label="Date de début" />
        <select className="ad-select" name="status" defaultValue={query.status ?? ""} aria-label="Statut">
          <option value="">Statut</option>
          {Object.entries(statusLabels).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
        </select>
        <a className="ad-btn ad-btn--ghost" href={href("/admin/export/seasons", params)}>Exporter <Upload size={16} aria-hidden="true" /></a>
      </AutoSubmitForm>
      <div className="ad-table-wrap">
        <div className="ad-table-scroll">
          <table className="ad-table">
            <thead><tr><th>Saison</th><th>Statut</th><th>Période</th><th>Équipes</th><th>Utilisateurs</th><th /></tr></thead>
            <tbody>
              {(seasons ?? []).map((season) => {
                const status = statusLabels[season.status] ?? statusLabels.draft;
                const stat = byId.get(season.id);
                return (
                  <tr key={season.id}>
                    <td><Link href={`/admin/saison/${season.id}`}>{season.name}</Link></td>
                    <td><Chip tone={status.tone}>{status.label}</Chip></td>
                    <td>{formatDate(season.starts_on)} - {formatDate(season.ends_on)}</td>
                    <td>{stat?.teams ?? 0}</td>
                    <td>{stat?.users ?? 0}</td>
                    <td className="ad-actions">
                      <Link className="ad-icon-btn" href={`/admin/saison/${season.id}`} aria-label={`Voir ${season.name}`}><Eye /></Link>
                      <ConfirmAction action={deleteSeason} fields={{ seasonId: season.id }} label="Supprimer" message={`Supprimer la saison « ${season.name} » ? Cette action est définitive.`} confirmLabel="Supprimer" disabled={season.status === "active"} />
                    </td>
                  </tr>
                );
              })}
              {!seasons?.length && <tr><td colSpan={6} className="ad-empty">Aucune saison.</td></tr>}
            </tbody>
          </table>
        </div>
        <TableFooter page={page} perPage={PER_PAGE} total={count ?? 0} hrefFor={(next) => href("/admin/saison", { ...params, page: next })} />
      </div>
    </main>
  );
}
