import { ActionForm, ConfirmAction, Modal } from "@/components/admin/client";
import { Chip, PageHeader, PhaseStepper, TableFooter, href, pageParam, type Tone } from "@/components/admin/ui";
import { formatCompactEuro, formatDateTime } from "@/lib/admin/format";
import { getJerseyImage } from "@/lib/jersey-map";
import { one } from "@/lib/supabase/relation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { cancelFreeTransfer, cancelMercadoOrderAdmin, extendMercato, freezeMercato, openMercato, reopenMercato, rollbackMercato, thawSite, updateMercatoValues } from "@/features/admin/mercato-actions";
import { buildMercadoReview } from "@/services/transfers/mercado-execution-service";

const PER_PAGE = 10;
const weekday = (iso?: string | null) => iso ? new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso)).replace(".", "").toUpperCase().replace(/(\w+)\s(\d+)/, "$1 $2") : undefined;
const orderTone: Record<string, Tone> = { pending: "warn", executed: "ok", cancelled: "off", rejected: "bad", completed: "ok" };
const orderLabel: Record<string, string> = { pending: "En attente", executed: "Validé", cancelled: "Annulé", rejected: "Rejeté", completed: "Validé" };
const stageToStep: Record<string, string> = { open: "open", frozen: "frozen", updated: "updated", thawed: "thawed", idle: "thawed" };

export default async function MercatoPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = pageParam((await searchParams).page);
  const db = createSupabaseAdminClient();
  const { data: live } = await db.from("matchdays").select("id,number,status,mercato_stage,mercato_opens_at,mercato_closes_at,thaw_at,seasons!inner(status)").eq("seasons.status", "active").eq("status", "mercado").order("number").limit(1).maybeSingle();
  const { data: last } = live ? { data: live } : await db.from("matchdays").select("id,number,status,mercato_stage,mercato_opens_at,mercato_closes_at,thaw_at,seasons!inner(status)").eq("seasons.status", "active").in("status", ["closed", "settled"]).order("number", { ascending: false }).limit(1).maybeSingle();
  const day = live ?? last;
  const stage = live ? live.mercato_stage : "idle";
  const { data: site } = await db.from("site_state").select("frozen").eq("id", true).single();

  const steps = [
    { id: "open", label: "Ouverture mercato", when: weekday(day?.mercato_opens_at) },
    { id: "frozen", label: "Gel total", when: weekday(day?.mercato_closes_at) },
    { id: "updated", label: "MAJ transferts & valeurs", when: weekday(day?.mercato_closes_at) },
    { id: "thawed", label: "Dégel total & transferts libres", when: weekday(day?.thaw_at) },
  ];

  let body: React.ReactNode = null;
  let actions: React.ReactNode = null;

  if (live && stage === "open") {
    const { data: orders, count } = await db.from("mercado_orders").select("id,status,created_at,sold:players!mercado_orders_sold_player_id_fkey(first_name,last_name,club_id),bought:players!mercado_orders_bought_player_id_fkey(first_name,last_name),squads(name,gamer_id)", { count: "exact" }).eq("matchday_id", live.id).order("created_at", { ascending: false }).range((page - 1) * PER_PAGE, page * PER_PAGE - 1);
    const rank = new Map<string, number>(); // order index per squad, oldest first
    const { data: all } = await db.from("mercado_orders").select("id,squad_id,created_at").eq("matchday_id", live.id).neq("status", "cancelled").order("created_at");
    const seen = new Map<string, number>();
    for (const order of all ?? []) { const n = (seen.get(order.squad_id) ?? 0) + 1; seen.set(order.squad_id, n); rank.set(order.id, n); }
    actions = <>
      <Modal size="sm" triggerClassName="ad-btn ad-btn--ghost" trigger="Prolonger" title="Prolonger le mercato">
        <ActionForm action={extendMercato} submitLabel="Prolonger" toast><input type="hidden" name="matchdayId" value={live.id} /><label className="ad-field"><span>Durée supplémentaire (heures)</span><input className="ad-input" type="number" name="hours" defaultValue={1} min={0.5} max={72} step={0.5} /></label></ActionForm>
      </Modal>
      <ConfirmAction action={freezeMercato} fields={{ matchdayId: live.id }} small={false} variant="primary" label="Fermer le mercato et geler le site" message="Fermer le mercato ? Plus aucun ordre ne pourra être placé et le site sera gelé pour tous les managers." confirmLabel="Fermer et geler" />
    </>;
    body = <>
      <div className="ad-table-scroll"><table className="ad-table">
        <thead><tr><th>Manager</th><th>Ordre</th><th>Sortant</th><th>Entrant</th><th>Statut</th><th>Date</th><th /></tr></thead>
        <tbody>
          {(orders ?? []).map((order) => {
            const sold = one(order.sold); const bought = one(order.bought); const squad = one(order.squads);
            return <tr key={order.id}><td>{squad?.name}</td><td>{rank.get(order.id) ?? "—"}/4</td><td>{sold?.first_name?.[0]}. {sold?.last_name}</td><td>{bought?.first_name?.[0]}. {bought?.last_name}</td><td><Chip tone={orderTone[order.status]}>{orderLabel[order.status] ?? order.status}</Chip></td><td>{formatDateTime(order.created_at)}</td>
              <td className="ad-actions">{order.status === "pending" && <ConfirmAction action={cancelMercadoOrderAdmin} fields={{ orderId: order.id }} label="Annuler" message="Annuler cet ordre ? Le manager récupère un emplacement." confirmLabel="Annuler l’ordre" />}</td></tr>;
          })}
          {!orders?.length && <tr><td colSpan={7} className="ad-empty">Aucun ordre pour le moment.</td></tr>}
        </tbody>
      </table></div>
      <TableFooter page={page} perPage={PER_PAGE} total={count ?? 0} hrefFor={(next) => href("/admin/mercato", { page: next })} />
    </>;
  } else if (live && (stage === "frozen" || stage === "updated")) {
    const rows = await valueRows(db, live.id, stage);
    if (stage === "frozen") actions = <>
      <ConfirmAction action={reopenMercato} fields={{ matchdayId: live.id }} small={false} variant="ghost" label="Réouvrir le mercato" message="Rouvrir le mercato ? Le site sera dégelé et les managers pourront à nouveau placer des ordres." confirmLabel="Réouvrir" />
      <ConfirmAction action={updateMercatoValues} fields={{ matchdayId: live.id }} small={false} variant="primary" label="Mettre à jour les valeurs" message="Exécuter les ordres, mettre à jour les budgets et les valeurs des joueurs ? Vous pourrez encore annuler cette étape." confirmLabel="Mettre à jour" />
    </>;
    else actions = <>
      <ConfirmAction action={rollbackMercato} fields={{ matchdayId: live.id }} small={false} variant="danger" label="Annuler le mercato" message="Annuler la mise à jour ? Les ordres redeviennent en attente, les budgets et les valeurs sont rétablis." confirmLabel="Annuler le mercato" />
      <ConfirmAction action={thawSite} fields={{ matchdayId: live.id }} small={false} variant="primary" label="Dégeler le site" message="Dégeler le site ? Cette étape clôture le Mercato : il ne pourra plus être annulé." confirmLabel="Dégeler" />
    </>;
    body = <>
      {"error" in rows ? <p className="ad-note ad-note--err" style={{ margin: 16 }} role="alert">{rows.error}</p> : (
        <div className="ad-table-scroll"><table className="ad-table">
          <thead><tr><th>Joueur</th><th>Valeur avant</th><th>Achats</th><th>Ventes</th><th>Effectif initial</th><th>Variation</th><th>Valeur après</th></tr></thead>
          <tbody>
            {rows.list.map((row) => <tr key={row.id}><td><span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>{/* eslint-disable-next-line @next/next/no-img-element */}<img className="ad-crest" src={getJerseyImage(row.club)} alt="" />{row.name}</span></td><td>{formatCompactEuro(row.before)}</td><td>{row.purchases}</td><td>{row.sales}</td><td>{row.initial}</td><td>{row.delta > 0 ? "+" : ""}{formatCompactEuro(row.delta)}</td><td>{formatCompactEuro(row.after)}</td></tr>)}
            {!rows.list.length && <tr><td colSpan={7} className="ad-empty">Aucun ordre : aucune valeur ne change.</td></tr>}
          </tbody>
        </table></div>
      )}
    </>;
  } else {
    actions = <ConfirmAction action={openMercato} fields={{ n: "1" }} small={false} variant="primary" label="Ouvrir le mercato" message="Ouvrir le Mercato de la prochaine journée ouverte ? Les managers pourront placer jusqu’à 4 ordres." confirmLabel="Ouvrir" />;
    const { data: transfers, count } = await db.from("direct_transfers").select("id,status,created_at,matchday_id,sold:players!direct_transfers_sold_player_id_fkey(first_name,last_name),bought:players!direct_transfers_bought_player_id_fkey(first_name,last_name),squads(name)", { count: "exact" }).order("created_at", { ascending: false }).range((page - 1) * PER_PAGE, page * PER_PAGE - 1);
    const { data: counts } = await db.from("direct_transfers").select("squad_id,matchday_id,created_at,id").eq("status", "completed").order("created_at");
    const nth = new Map<string, number>(); const perKey = new Map<string, number>();
    const { data: sq } = await db.from("direct_transfers").select("id,squad_id,matchday_id");
    const keyOf = new Map((sq ?? []).map((t) => [t.id, `${t.squad_id}:${t.matchday_id}`]));
    for (const t of counts ?? []) { const key = keyOf.get(t.id) ?? ""; const n = (perKey.get(key) ?? 0) + 1; perKey.set(key, n); nth.set(t.id, n); }
    body = <>
      <div className="ad-table-scroll"><table className="ad-table">
        <thead><tr><th>Date</th><th>Manager</th><th>Transfert</th><th>Sortant</th><th>Entrant</th><th>Statut</th><th /></tr></thead>
        <tbody>
          {(transfers ?? []).map((t) => <tr key={t.id}><td>{formatDateTime(t.created_at)}</td><td>{one(t.squads)?.name}</td><td>{nth.get(t.id) ? `${nth.get(t.id)}/4` : "—"}</td><td>{one(t.sold)?.first_name?.[0]}. {one(t.sold)?.last_name}</td><td>{one(t.bought)?.first_name?.[0]}. {one(t.bought)?.last_name}</td><td><Chip tone={orderTone[t.status]}>{orderLabel[t.status] ?? t.status}</Chip></td>
            <td className="ad-actions">{t.status === "completed" && <ConfirmAction action={cancelFreeTransfer} fields={{ transferId: t.id }} label="Annuler" message="Annuler ce transfert libre ? L’équipe, le budget et les valeurs sont rétablis." confirmLabel="Annuler le transfert" />}</td></tr>)}
          {!transfers?.length && <tr><td colSpan={7} className="ad-empty">Aucun transfert libre.</td></tr>}
        </tbody>
      </table></div>
      <TableFooter page={page} perPage={PER_PAGE} total={count ?? 0} hrefFor={(next) => href("/admin/mercato", { page: next })} />
    </>;
  }

  return (
    <main>
      <PageHeader title="Mercato" actions={<>{day && <Chip tone="info">J{day.number}</Chip>}<Chip tone={site?.frozen ? "bad" : "ok"}>{site?.frozen ? "Site gelé" : "Site ouvert"}</Chip></>} />
      <div className="ad-card ad-card--steps" style={{ padding: 20, marginBottom: 20 }}>
        <PhaseStepper steps={steps} active={stageToStep[stage] ?? "thawed"} doneBefore={false} />
        <div className="ad-step-actions">{actions}</div>
      </div>
      <div className="ad-table-wrap">{body}</div>
    </main>
  );
}

type Db = ReturnType<typeof createSupabaseAdminClient>;
/** Per-player value table: preview while frozen (from the order book), recorded values once updated. */
async function valueRows(db: Db, matchdayId: string, stage: string): Promise<{ error: string } | { list: { id: string; name: string; club: string; before: number; purchases: number; sales: number; initial: number; delta: number; after: number }[] }> {
  const { data: orders } = await db.from("mercado_orders").select("id,squad_id,sold_player_id,bought_player_id,status").eq("matchday_id", matchdayId).in("status", ["pending", "executed"]);
  const ids = [...new Set((orders ?? []).flatMap((o) => [o.sold_player_id, o.bought_player_id]))];
  if (!ids.length) return { list: [] };
  const [{ data: players }, { data: members }, { data: history }] = await Promise.all([
    db.from("players").select("id,first_name,last_name,marketfoot_value,clubs(name)").in("id", ids),
    db.from("squad_members").select("squad_id,player_id,is_initial").in("squad_id", [...new Set((orders ?? []).map((o) => o.squad_id))]),
    db.from("player_value_history").select("player_id,previous_value,next_value,created_at").eq("matchday_id", matchdayId).eq("reason", "mercado_demand").order("created_at"),
  ]);
  let preview: Awaited<ReturnType<typeof buildMercadoReview>>["values"] | null = null;
  if (stage === "frozen") { try { preview = (await buildMercadoReview(matchdayId)).values; } catch (error) { return { error: error instanceof Error ? error.message : "La revue est indisponible." }; } }
  const list = (players ?? []).map((p) => {
    const bought = (orders ?? []).filter((o) => o.bought_player_id === p.id).length;
    const soldOrders = (orders ?? []).filter((o) => o.sold_player_id === p.id);
    const initialSales = soldOrders.filter((o) => stage === "frozen" ? members?.some((m) => m.squad_id === o.squad_id && m.player_id === p.id && m.is_initial) : false).length;
    const hist = (history ?? []).find((h) => h.player_id === p.id);
    const view = preview?.find((v) => v.playerId === p.id);
    const before = view ? view.beforeValue : hist ? Number(hist.previous_value) : Number(p.marketfoot_value);
    const after = hist ? Number(hist.next_value) : Math.max(500000, before + (view?.delta ?? 0));
    return { id: p.id, name: `${p.first_name?.[0] ?? ""}. ${(p as unknown as { last_name: string }).last_name}`.trim(), club: one(p.clubs)?.name ?? "", before, purchases: view?.purchases ?? bought, sales: view?.sales ?? soldOrders.length - initialSales, initial: initialSales, delta: after - before, after };
  });
  return { list: list.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)) };
}
