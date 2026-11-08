import Link from "next/link";

import { Card, Chip, Kpi, PageHeader } from "@/components/admin/ui";
import { formatDateTime } from "@/lib/admin/format";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const phase: Record<string, string> = { draft: "Brouillon", open: "Ouverte", mercado: "Mercato", closed: "Clôturée", settled: "Réglée" };

export default async function AdminDashboard() {
  const db = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const [{ data: kpis }, { data: season }, { data: site }] = await Promise.all([
    db.rpc("admin_manager_kpis"),
    db.from("seasons").select("id,name,status").eq("status", "active").maybeSingle(),
    db.from("site_state").select("frozen").eq("id", true).single(),
  ]);
  const { data: days } = season ? await db.from("matchdays").select("id,number,status,mercato_stage").eq("season_id", season.id).order("number") : { data: [] };
  const current = (days ?? []).find((d) => ["open", "mercado", "closed"].includes(d.status)) ?? [...(days ?? [])].reverse().find((d) => d.status === "settled");
  const dayIds = (days ?? []).map((d) => d.id);
  const [{ count: toEnter }, { count: pendingSettlements }, { count: pendingOrders }, { count: awaitingValidation }, { data: logs }] = await Promise.all([
    dayIds.length ? db.from("matches").select("id", { count: "exact", head: true }).in("matchday_id", dayIds).eq("is_postponed", false).neq("sheet_status", "validated").lt("kickoff_at", new Date(Date.now() - 2 * 3_600_000).toISOString()) : Promise.resolve({ count: 0 }),
    db.from("matchday_settlements").select("id", { count: "exact", head: true }).eq("status", "pending"),
    db.from("mercado_orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
    db.from("seasons").select("id", { count: "exact", head: true }).eq("status", "pending_validation"),
    db.from("admin_audit_log").select("id,action,entity_type,created_at,actor_id").order("created_at", { ascending: false }).limit(8),
  ]);
  const actorIds = [...new Set((logs ?? []).map((log) => log.actor_id))];
  const { data: actors } = actorIds.length ? await db.from("profiles").select("id,username").in("id", actorIds) : { data: [] };
  const who = new Map((actors ?? []).map((a) => [a.id, a.username]));
  const kpi = ((kpis ?? [])[0] ?? { total: 0, new_this_week: 0, online: 0 }) as { total: number; new_this_week: number; online: number };
  const todo = [
    { label: "Feuilles de match à saisir ou valider", value: toEnter ?? 0, href: "/admin/saisie" },
    { label: "Règlements à revoir", value: pendingSettlements ?? 0, href: "/admin/saisie/publication" },
    { label: "Ordres Mercato en attente", value: pendingOrders ?? 0, href: "/admin/mercato" },
    { label: "Saisons à valider", value: awaitingValidation ?? 0, href: "/admin/saison" },
  ];

  return (
    <main>
      <PageHeader title="Dashboard" actions={<><Chip tone={site?.frozen ? "bad" : "ok"}>{site?.frozen ? "Site gelé" : "Site ouvert"}</Chip>{season && <Chip tone="info">{season.name}</Chip>}</>} />
      <div className="ad-kpis">
        <Kpi label="Inscrits" value={Number(kpi.total).toLocaleString("fr-FR")} />
        <Kpi label="Nouveaux inscrits cette semaine" value={Number(kpi.new_this_week).toLocaleString("fr-FR")} />
        <Kpi label="En ligne" value={Number(kpi.online).toLocaleString("fr-FR")} />
      </div>
      <div className="ad-grid-2">
        <Card title="Journée en cours">
          {current ? (
            <div className="ad-stack" style={{ gap: 12 }}>
              <div className="ad-counter-row"><b style={{ fontSize: 22 }}>Journée {current.number}</b><Chip tone={current.status === "settled" ? "ok" : "info"}>{phase[current.status]}</Chip></div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Link className="ad-btn ad-btn--outline" href={`/admin/saisie?day=${current.number}`}>Saisie</Link>
                <Link className="ad-btn ad-btn--outline" href="/admin/mercato">Mercato</Link>
                <Link className="ad-btn ad-btn--outline" href="/admin/saisie/publication">Règlements</Link>
              </div>
            </div>
          ) : <p className="ad-muted">Aucune saison en cours. <Link href="/admin/saison">Créer ou valider une saison</Link>.</p>}
        </Card>
        <Card title="À traiter">
          {todo.map((item) => <Link key={item.label} href={item.href} className="ad-counter-row" style={{ textDecoration: "none" }}><span>{item.label}</span><Chip tone={item.value ? "warn" : "ok"}>{item.value}</Chip></Link>)}
        </Card>
      </div>
      <Card title="Activité récente" className="ad-section" flush>
        <table className="ad-table"><tbody>
          {(logs ?? []).map((log) => <tr key={log.id}><td style={{ width: 170 }}>{formatDateTime(log.created_at)}</td><td>{who.get(log.actor_id) ?? "—"}</td><td><code>{log.action}</code></td><td>{log.entity_type}</td></tr>)}
          {!logs?.length && <tr><td className="ad-empty">Aucune activité.</td></tr>}
        </tbody></table>
        <div className="ad-card-body"><Link href="/admin/parametres">Voir tout le journal d’audit →</Link></div>
      </Card>
      <p className="ad-muted" style={{ marginTop: 12, fontSize: 12 }}>Mis à jour le {formatDateTime(now)}</p>
    </main>
  );
}
