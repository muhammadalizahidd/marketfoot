import Link from "next/link";

import { Card, Chip, Crumbs, Kpi, PageHeader, type Tone } from "@/components/admin/ui";
import { formatDateTime, formatEuro } from "@/lib/admin/format";
import { one } from "@/lib/supabase/relation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { SettlementControls } from "@/features/admin/settlement-controls";
import { buildSettlementReview } from "@/services/settlements/settlement-service";

const tone: Record<string, Tone> = { pending: "warn", running: "info", completed: "ok", failed: "bad", reverted: "off" };
const label: Record<string, string> = { pending: "À revoir", running: "En cours", completed: "Comptabilisé", failed: "Échec", reverted: "Annulé" };

/** Saisie → Publier: review every effect before the accounts are credited (kept from the former "Règlements" page). */
export default async function PublicationPage() {
  const db = createSupabaseAdminClient();
  const { data: settlements } = await db.from("matchday_settlements").select("id,status,rules_version,attempt,created_at,matchday_id,matchdays(number)").order("created_at", { ascending: false });
  const pending = settlements?.find((settlement) => settlement.status === "pending");
  let review: Awaited<ReturnType<typeof buildSettlementReview>> | null = null;
  let reviewError: string | null = null;
  if (pending) { try { review = await buildSettlementReview(pending.id); } catch (error) { reviewError = error instanceof Error ? error.message : "La revue est indisponible."; } }
  const day = pending ? one(pending.matchdays)?.number ?? "?" : null;

  return (
    <main>
      <Crumbs items={[{ label: "⌂", href: "/admin" }, { label: "Saisie", href: "/admin/saisie" }, { label: "Publication" }]} />
      <div className="ad-section"><PageHeader title="Revue des règlements" actions={<Chip tone={pending ? "warn" : "ok"}>{pending ? `J${day} · à revoir` : "Journal à jour"}</Chip>} /></div>

      {pending && (
        <div className="ad-stack">
          <div className="ad-grid-2">
            <Card title="Calculs prêts"><Kpi label="Effets joueur" value={review?.effects.length ?? 0} />
              <p className="ad-muted" style={{ marginTop: 10 }}>{review ? `${review.predictions.length} manager(s) reçoivent un résultat de pronostics. ${review.deferredPlayers} joueur(s) concerné(s) par un match reporté sont différés.` : "La revue attend des résultats complets."}</p></Card>
            <Card title="Impact financier"><Kpi label="Montant brut" value={review ? formatEuro(review.totals.gross) : "—"} />
              <p className="ad-muted" style={{ marginTop: 10 }}>Budget : <b>{review ? formatEuro(review.totals.budget) : "—"}</b> · Compte bloqué : <b>{review ? formatEuro(review.totals.locked) : "—"}</b></p></Card>
          </div>
          <Card title={`Détail vérifiable · J${day}`} flush>
            {reviewError ? <p className="ad-note ad-note--err" style={{ margin: 16 }} role="alert">{reviewError}</p> : (
              <div className="ad-table-scroll">
                <table className="ad-table">
                  <thead><tr><th>Équipe</th><th>Joueur</th><th>Normal</th><th>Capitaine</th><th>Bonus</th><th>Effet manager</th><th>Budget</th><th>Bloqué</th></tr></thead>
                  <tbody>{review?.effects.map((effect) => <tr key={effect.snapshotId}><td>{effect.squadName}</td><td>{effect.playerName}</td><td>{formatEuro(effect.normalEffect)}</td><td>{formatEuro(effect.captainAdjustment)}</td><td>{effect.bonusAdjustment ? formatEuro(effect.bonusAdjustment) : "—"}</td><td>{formatEuro(effect.gamerEffect)}</td><td>{formatEuro(effect.budgetDelta)}</td><td>{formatEuro(effect.lockedAccountDelta)}</td></tr>)}</tbody>
                </table>
              </div>
            )}
            {review && review.predictions.length > 0 && (
              <div className="ad-table-scroll">
                <h3 style={{ padding: "16px 16px 0" }}>Pronostics · moyenne {review.predictions[0].averagePct.toFixed(1)} %</h3>
                <table className="ad-table">
                  <thead><tr><th>Équipe</th><th>Bons</th><th>Résultat</th><th>Écart</th><th>Gain</th><th>Budget</th><th>Bloqué</th></tr></thead>
                  <tbody>{review.predictions.map((p) => <tr key={p.gamerId}><td>{p.squadName}</td><td>{p.correct}/{p.eligible}</td><td>{p.resultPct.toFixed(1)} %</td><td>{p.x.toFixed(1)}</td><td>{formatEuro(p.earnings)}</td><td>{formatEuro(p.budgetDelta)}</td><td>{formatEuro(p.lockedAccountDelta)}</td></tr>)}</tbody>
                </table>
              </div>
            )}
            <div className="ad-card-body" style={{ display: "flex", justifyContent: "flex-end" }}><SettlementControls settlementId={pending.id} status={pending.status} /></div>
          </Card>
        </div>
      )}
      {!pending && <Card title="Journal de règlement"><p className="ad-muted">Clôturez une journée puis cliquez sur « Publier » depuis <Link href="/admin/saisie">Saisie</Link> pour afficher la revue.</p></Card>}

      <Card title="Historique" className="ad-section" flush>
        {settlements?.length ? (
          <div className="ad-table-scroll">
            <table className="ad-table">
              <thead><tr><th>Journée</th><th>Version</th><th>Essai</th><th>État</th><th>Créé le</th><th /></tr></thead>
              <tbody>{settlements.map((s) => <tr key={s.id}><td>J{one(s.matchdays)?.number ?? "?"}</td><td>{s.rules_version}</td><td>{s.attempt}</td><td><Chip tone={tone[s.status] ?? "off"}>{label[s.status] ?? s.status}</Chip></td><td>{formatDateTime(s.created_at)}</td><td className="ad-actions">{s.status === "completed" && <SettlementControls settlementId={s.id} status={s.status} />}</td></tr>)}</tbody>
            </table>
          </div>
        ) : <p className="ad-empty">Aucun règlement demandé.</p>}
      </Card>
    </main>
  );
}
