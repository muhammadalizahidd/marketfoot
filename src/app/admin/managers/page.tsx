import Link from "next/link";
import { Eye, Upload } from "lucide-react";

import { AutoSubmitForm, ConfirmAction } from "@/components/admin/client";
import { Chip, Kpi, PageHeader, TableFooter, href, pageParam, type Tone } from "@/components/admin/ui";
import { formatDate } from "@/lib/admin/format";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { deleteManager } from "@/features/admin/managers-actions";

const PER_PAGE = 10;
const statusTone: Record<string, Tone> = { active: "ok", inactive: "off", banned: "bad" };
const statusLabel: Record<string, string> = { active: "Actif", inactive: "Inactif", banned: "Banni" };
type Row = { id: string; username: string; email: string; status: string; created_at: string; last_sign_in_at: string | null; last_seen_at: string | null; linked: number; total: number };

export default async function ManagersPage({ searchParams }: { searchParams: Promise<{ q?: string; since?: string; status?: string; page?: string }> }) {
  const query = await searchParams;
  const page = pageParam(query.page);
  const db = createSupabaseAdminClient();
  const status = query.status && statusLabel[query.status] ? query.status : "";
  const since = query.since && /^\d{4}-\d{2}-\d{2}$/.test(query.since) ? query.since : null;
  const [{ data: rows }, { data: kpis }] = await Promise.all([
    db.rpc("admin_managers", { p_search: query.q?.trim() ?? "", p_status: status, p_since: since, p_limit: PER_PAGE, p_offset: (page - 1) * PER_PAGE }),
    db.rpc("admin_manager_kpis"),
  ]);
  const list = (rows ?? []) as Row[];
  const total = Number(list[0]?.total ?? 0);
  const kpi = ((kpis ?? [])[0] ?? { total: 0, new_this_week: 0, online: 0 }) as { total: number; new_this_week: number; online: number };
  const params = { q: query.q, since: query.since, status };

  return (
    <main>
      <PageHeader title="Managers" />
      <div className="ad-kpis">
        <Kpi label="Inscrits" value={Number(kpi.total).toLocaleString("fr-FR")} />
        <Kpi label="Nouveaux inscrits cette semaine" value={Number(kpi.new_this_week).toLocaleString("fr-FR")} />
        <Kpi label="En ligne" value={Number(kpi.online).toLocaleString("fr-FR")} />
      </div>
      <AutoSubmitForm>
        <input className="ad-input ad-input--search" name="q" defaultValue={query.q} placeholder="Rechercher" aria-label="Rechercher un manager" />
        <input className="ad-input" type="date" name="since" defaultValue={query.since} aria-label="Inscrit depuis le" />
        <select className="ad-select" name="status" defaultValue={status} aria-label="Statut"><option value="">Statut</option>{Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <a className="ad-btn ad-btn--ghost" href={href("/admin/export/managers", { q: query.q, since: query.since, status })}>Exporter <Upload size={16} aria-hidden="true" /></a>
      </AutoSubmitForm>
      <div className="ad-table-wrap">
        <div className="ad-table-scroll">
          <table className="ad-table">
            <thead><tr><th>Nom</th><th>Mail</th><th>Statut</th><th>Inscription</th><th>Dernière connexion</th><th>Compte lié</th><th /></tr></thead>
            <tbody>
              {list.map((manager) => (
                <tr key={manager.id}>
                  <td><Link href={`/admin/managers/${manager.id}`}>{manager.username}</Link></td>
                  <td>{manager.email}</td>
                  <td><Chip tone={statusTone[manager.status]}>{statusLabel[manager.status] ?? manager.status}</Chip></td>
                  <td>{formatDate(manager.created_at)}</td>
                  <td>{formatDate(manager.last_seen_at ?? manager.last_sign_in_at)}</td>
                  <td>{manager.linked > 0 ? <Chip tone="warn">{manager.linked} lié{manager.linked > 1 ? "s" : ""}</Chip> : "-"}</td>
                  <td className="ad-actions">
                    <Link className="ad-icon-btn" href={`/admin/managers/${manager.id}`} aria-label={`Voir ${manager.username}`}><Eye /></Link>
                    <ConfirmAction action={deleteManager} fields={{ managerId: manager.id }} label="Supprimer" message={`Supprimer le compte de ${manager.username} ? S’il a un historique de jeu, il sera anonymisé et verrouillé.`} confirmLabel="Supprimer" />
                  </td>
                </tr>
              ))}
              {!list.length && <tr><td colSpan={7} className="ad-empty">Aucun manager.</td></tr>}
            </tbody>
          </table>
        </div>
        <TableFooter page={page} perPage={PER_PAGE} total={total} hrefFor={(next) => href("/admin/managers", { ...params, page: next })} />
      </div>
    </main>
  );
}
