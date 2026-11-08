import Link from "next/link";

import { ActionForm, ConfirmAction } from "@/components/admin/client";
import { Card, Chip, PageHeader, TableFooter, href, pageParam } from "@/components/admin/ui";
import { formatDateTime } from "@/lib/admin/format";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { saveBaremes } from "@/features/admin/baremes-actions";
import { demoteAdmin, promoteAdmin, purgeIpEvents, toggleSiteFreeze } from "@/features/admin/parametres-actions";
import { ensureRulesSettings } from "@/services/rules-settings";

const PER_PAGE = 15;
const days = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const slots = [["mercatoOpen", "Ouverture du mercato"], ["mercatoClose", "Fermeture du mercato"], ["thaw", "Dégel du site"]] as const;

export default async function ParametresPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = pageParam((await searchParams).page);
  const db = createSupabaseAdminClient();
  const [{ settings }, { data: site }, { data: admins }, { data: logs, count }] = await Promise.all([
    ensureRulesSettings(),
    db.from("site_state").select("frozen,reason,updated_at").eq("id", true).single(),
    db.from("profiles").select("id,username,created_at").eq("role", "admin").order("created_at"),
    db.from("admin_audit_log").select("id,action,entity_type,entity_id,created_at,actor_id", { count: "exact" }).order("created_at", { ascending: false }).range((page - 1) * PER_PAGE, page * PER_PAGE - 1),
  ]);
  const actorIds = [...new Set((logs ?? []).map((log) => log.actor_id))];
  const { data: actors } = actorIds.length ? await db.from("profiles").select("id,username").in("id", actorIds) : { data: [] };
  const who = new Map((actors ?? []).map((actor) => [actor.id, actor.username]));

  return (
    <main>
      <PageHeader title="Paramètres" />
      <div className="ad-stack">
        <div className="ad-grid-2">
          <Card title="Calendrier par défaut du Mercato (PRD §7.5)">
            <ActionForm action={saveBaremes} submitLabel="Enregistrer le calendrier">
              <input type="hidden" name="tab" value="parametres" />
              <p className="ad-muted">Jour et heure proposés par défaut sur l’écran Saisie (Europe/Paris). Chaque journée peut ensuite être ajustée.</p>
              {slots.map(([key, label]) => (
                <div key={key} className="ad-form-row">
                  <label className="ad-field"><span>{label} — jour</span><select className="ad-select" name={`schedule.${key}.day`} defaultValue={settings.schedule[key].day}>{days.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label>
                  <label className="ad-field"><span>Heure</span><input className="ad-input" type="time" name={`str:schedule.${key}.time`} defaultValue={settings.schedule[key].time} required /></label>
                </div>
              ))}
            </ActionForm>
          </Card>

          <Card title="État du site" actions={<Chip tone={site?.frozen ? "bad" : "ok"}>{site?.frozen ? "Gelé" : "Ouvert"}</Chip>}>
            <div className="ad-stack" style={{ gap: 14 }}>
              <p className="ad-muted">{site?.frozen ? `Gel actif (${site.reason ?? "—"}) depuis le ${formatDateTime(site.updated_at)} : les managers sont en lecture seule.` : "Le gel total est aussi déclenché automatiquement par l’écran Mercato. Utilisez ce bouton pour une maintenance."}</p>
              {site?.frozen
                ? <ConfirmAction action={toggleSiteFreeze} fields={{ frozen: "false" }} small={false} variant="primary" label="Dégeler le site" message="Dégeler le site pour tous les managers ?" confirmLabel="Dégeler" />
                : <ActionForm action={toggleSiteFreeze} submitLabel="Geler le site" submitClassName="ad-btn ad-btn--danger"><input type="hidden" name="frozen" value="true" /><label className="ad-field"><span>Motif (affiché en interne)</span><input className="ad-input" name="reason" maxLength={200} placeholder="Maintenance" /></label></ActionForm>}
            </div>
          </Card>
        </div>

        <div className="ad-grid-2">
          <Card title="Administrateurs" flush>
            <table className="ad-table"><tbody>
              {(admins ?? []).map((admin) => <tr key={admin.id}><td>{admin.username}</td><td>{formatDateTime(admin.created_at).slice(0, 8)}</td><td className="ad-actions"><ConfirmAction action={demoteAdmin} fields={{ adminId: admin.id }} label="Retirer" message={`Retirer les droits administrateur de ${admin.username} ?`} confirmLabel="Retirer" /></td></tr>)}
            </tbody></table>
            <div className="ad-card-body"><ActionForm action={promoteAdmin} submitLabel="Ajouter" className="ad-form"><label className="ad-field"><span>Pseudo du compte à promouvoir</span><input className="ad-input" name="username" required minLength={3} maxLength={32} /></label></ActionForm></div>
          </Card>

          <Card title="Historique, corrections et confidentialité">
            <div className="ad-stack" style={{ gap: 12 }}>
              <p>Correction d’une journée déjà réglée : <Link href="/admin/saisie/publication">annulez le règlement</Link> (motif obligatoire), corrigez la feuille de match, puis republiez. Budgets, valeurs et pronostics sont recalculés.</p>
              <p>Fin de saison : depuis <Link href="/admin/saison">Saison</Link>, « Terminer la saison » enregistre les valeurs de fin et attribue les points palmarès.</p>
              <p className="ad-muted">Les empreintes de connexion servant à repérer les comptes liés sont conservées 90 jours puis supprimées.</p>
              <ActionForm action={purgeIpEvents} submitLabel="Purger les empreintes de plus de 90 jours" submitClassName="ad-btn ad-btn--ghost ad-btn--sm" className="ad-inline-form" />
            </div>
          </Card>
        </div>

        <Card title="Journal d’audit" flush>
          <div className="ad-table-scroll"><table className="ad-table">
            <thead><tr><th>Date</th><th>Acteur</th><th>Action</th><th>Objet</th></tr></thead>
            <tbody>
              {(logs ?? []).map((log) => <tr key={log.id}><td>{formatDateTime(log.created_at)}</td><td>{who.get(log.actor_id) ?? "—"}</td><td><code>{log.action}</code></td><td>{log.entity_type}{log.entity_id ? ` · ${log.entity_id.slice(0, 8)}` : ""}</td></tr>)}
              {!logs?.length && <tr><td colSpan={4} className="ad-empty">Aucune entrée.</td></tr>}
            </tbody>
          </table></div>
          <TableFooter page={page} perPage={PER_PAGE} total={count ?? 0} hrefFor={(next) => href("/admin/parametres", { page: next })} />
        </Card>
      </div>
    </main>
  );
}
