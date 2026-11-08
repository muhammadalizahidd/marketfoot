import { ensureRulesSettings } from "@/services/rules-settings";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isTeamFrozen } from "@/rules/freeze";
import { getTransferTaxRate } from "@/rules/transfers";
import { one } from "@/lib/supabase/relation";
import { getCurrentUserId } from "@/lib/auth/session";
import { getMySquad } from "@/data/repositories/squad-repository";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  TransferManager,
  type TransferMember,
  type CataloguePlayer,
  type MercadoOrderView,
} from "@/features/transfers/transfer-manager";

export default async function TransfersPage() {
  await ensureRulesSettings();
  const userId = await getCurrentUserId();
  if (!userId) redirect("/connexion");

  const squad = await getMySquad(userId);
  if (!squad) {
    return (
      <main className="app-page">
        <section className="empty-state">
          <h1>Votre équipe n’est pas encore créée</h1>
          <p>Composez votre effectif de 19 joueurs pour commencer.</p>
          <Link className="primary-action" href="/onboarding">
            Créer mon équipe
          </Link>
        </section>
      </main>
    );
  }

  const supabase = await createSupabaseServerClient();
  const db = createSupabaseAdminClient();

  // Load finance, matchday, catalogue, orders
  const [
    { data: finances },
    { data: matchday },
    { data: catalogueRaw },
  ] = await Promise.all([
    supabase.from("gamer_finances").select("budget").eq("gamer_id", userId).maybeSingle(),
    supabase.from("matchdays").select("id, number, status").in("status", ["open", "mercado"]).order("number").limit(1).maybeSingle(),
    supabase.from("players").select("id, first_name, last_name, position, marketfoot_value, club_id, clubs(name)").eq("is_active", true).order("marketfoot_value", { ascending: false }),
  ]);

  // Check fixtures for frozen state
  const { data: fixtures } = matchday
    ? await db.from("matches").select("home_club_id,away_club_id,kickoff_at").eq("matchday_id", matchday.id)
    : { data: [] };
  const frozen = new Set(
    (fixtures ?? [])
      .filter((m) => isTeamFrozen(new Date(m.kickoff_at), new Date()))
      .flatMap((m) => [m.home_club_id, m.away_club_id])
  );

  // Transfers already made count
  let transfersAlreadyMade = 0;
  if (squad && matchday) {
    if (matchday.status === "open") {
      const { count } = await supabase
        .from("direct_transfers")
        .select("id", { count: "exact", head: true })
        .eq("squad_id", squad.id)
        .eq("matchday_id", matchday.id)
        .eq("status", "completed");
      transfersAlreadyMade = count ?? 0;
    } else if (matchday.status === "mercado") {
      const { count } = await supabase
        .from("mercado_orders")
        .select("id", { count: "exact", head: true })
        .eq("squad_id", squad.id)
        .eq("matchday_id", matchday.id)
        .eq("status", "pending");
      transfersAlreadyMade = count ?? 0;
    }
  }

  // Mercado orders history
  const { data: ordersRaw } = squad
    ? await supabase
        .from("mercado_orders")
        .select("id,status,created_at,sold:players!mercado_orders_sold_player_id_fkey(first_name,last_name),bought:players!mercado_orders_bought_player_id_fkey(first_name,last_name)")
        .eq("squad_id", squad.id)
        .order("created_at", { ascending: false })
        .limit(6)
    : { data: [] };

  const ownedIds = new Set(squad.squad_members?.map((m) => m.player_id) ?? []);

  // How many gamers hold each of my players (the "Possesseur" display mode).
  const { data: holderRows } = ownedIds.size
    ? await db.from("squad_members").select("player_id").in("player_id", [...ownedIds])
    : { data: [] as { player_id: string }[] };
  const owners = new Map<string, number>();
  for (const row of holderRows ?? []) owners.set(row.player_id, (owners.get(row.player_id) ?? 0) + 1);

  const members: TransferMember[] = (squad.squad_members ?? []).map((m) => ({
    id: m.player_id,
    name: `${one(m.players)?.first_name ?? ""} ${one(m.players)?.last_name ?? ""}`.trim(),
    position: one(m.players)?.position ?? "—",
    value: Number(one(m.players)?.marketfoot_value ?? m.acquired_value),
    isStarter: m.is_starter,
    isCaptain: m.is_captain,
    frozen: frozen.has(one(m.players)?.club_id ?? ""),
    clubName: one(one(m.players)?.clubs)?.name ?? "",
    clubId: one(m.players)?.club_id ?? "",
    acquiredValue: Number(m.acquired_value),
    owners: owners.get(m.player_id) ?? 1,
  }));

  const catalogue: CataloguePlayer[] = (catalogueRaw ?? []).map((p) => ({
    id: p.id,
    name: `${p.first_name} ${p.last_name}`.trim(),
    position: p.position,
    club: one(p.clubs)?.name ?? "",
    clubId: p.club_id,
    value: Number(p.marketfoot_value),
    owned: ownedIds.has(p.id),
  }));

  const orders: MercadoOrderView[] = (ordersRaw ?? []).map((o) => ({
    id: o.id,
    status: o.status,
    sold: `${one(o.sold)?.first_name ?? ""} ${one(o.sold)?.last_name ?? ""}`.trim(),
    bought: `${one(o.bought)?.first_name ?? ""} ${one(o.bought)?.last_name ?? ""}`.trim(),
  }));

  return (
    <main className="app-page" style={{ padding: 0 }}>
      <TransferManager
        members={members}
        catalogue={catalogue}
        mode={matchday?.status === "open" || matchday?.status === "mercado" ? matchday.status : null}
        matchdayNumber={matchday?.number ?? 1}
        matchdayId={matchday?.id ?? null}
        currentBudget={Number(finances?.budget ?? 0)}
        transfersAlreadyMade={transfersAlreadyMade}
        orders={orders}
        taxRates={{ direct: getTransferTaxRate(matchday?.number ?? 1, "direct"), mercado: getTransferTaxRate(matchday?.number ?? 1, "mercado") }}
      />
    </main>
  );
}
