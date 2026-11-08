import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { ActionForm, ConfirmAction, Modal } from "@/components/admin/client";
import { Card, Chip, Crumbs, PageHeader, PositionBadge } from "@/components/admin/ui";
import { bonusCatalogue } from "@/lib/bonus-catalogue";
import { formatCompactEuro, formatDateTime } from "@/lib/admin/format";
import { getJerseyImage } from "@/lib/jersey-map";
import { one } from "@/lib/supabase/relation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { adjustFinance, banManager, deleteManager, resendVerification, resetBonusCounter, resetCaptainCounter, resetManager, sendPasswordReset, unbanManager, updateManagerProfile } from "@/features/admin/managers-actions";
import { ensureRulesSettings } from "@/services/rules-settings";
import { marketfootRulesConfig } from "@/rules/config";

const order = ["GK", "DF", "MF", "FW"];
type Member = { player_id: string; position: string; first: string; last: string; club: string; starter: boolean; captain: boolean };

export default async function ManagerDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ day?: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const { day: dayParam } = await searchParams;
  const db = createSupabaseAdminClient();
  const [{ data: profile }, { settings }] = await Promise.all([db.from("profiles").select("*").eq("id", id).maybeSingle(), ensureRulesSettings()]);
  if (!profile || profile.role !== "gamer") notFound();
  const [{ data: auth }, { data: finance }, { data: squad }, { data: clubs }, { data: season }, { data: myIps }] = await Promise.all([
    db.auth.admin.getUserById(id),
    db.from("gamer_finances").select("budget,blocked_account").eq("gamer_id", id).maybeSingle(),
    db.from("squads").select("id,name").eq("gamer_id", id).maybeSingle(),
    db.from("clubs").select("id,name").order("name"),
    db.from("seasons").select("id").eq("status", "active").maybeSingle(),
    db.from("profile_ip_events").select("ip_hash").eq("gamer_id", id),
  ]);
  const email = auth.user?.email ?? "—";
  const masked = email.replace(/^(.{2}).*(@.*)$/, (_, a: string, b: string) => `${a}${"*".repeat(8)}${b}`);

  const hashes = [...new Set((myIps ?? []).map((row) => row.ip_hash))];
  const { data: sameIp } = hashes.length ? await db.from("profile_ip_events").select("gamer_id,created_at").in("ip_hash", hashes).neq("gamer_id", id) : { data: [] };
  const linkedIds = [...new Set((sameIp ?? []).map((row) => row.gamer_id))];
  const { data: linked } = linkedIds.length ? await db.from("profiles").select("id,username,banned_at,created_at,avatar_url").in("id", linkedIds) : { data: [] };

  // Team: live squad for the current matchday, or the frozen snapshot of a past one.
  const { data: days } = season ? await db.from("matchdays").select("id,number,status").eq("season_id", season.id).order("number") : { data: [] };
  const liveDay = (days ?? []).find((d) => d.status === "open" || d.status === "mercado");
  const snapshotDays = squad ? ((await db.from("matchday_squad_snapshots").select("matchday_id").eq("gamer_id", id)).data ?? []).map((row) => row.matchday_id) : [];
  const selectable = (days ?? []).filter((d) => d.id === liveDay?.id || snapshotDays.includes(d.id));
  const selected = selectable.find((d) => d.id === dayParam) ?? selectable.find((d) => d.id === liveDay?.id) ?? selectable.at(-1);
  const index = selectable.findIndex((d) => d.id === selected?.id);
  let members: Member[] = [];
  if (squad && selected) {
    if (selected.id === liveDay?.id) {
      const { data } = await db.from("squad_members").select("player_id,is_starter,is_captain,players(first_name,last_name,position,clubs(name))").eq("squad_id", squad.id);
      members = (data ?? []).map((m) => ({ player_id: m.player_id, position: one(m.players)?.position ?? "MF", first: one(m.players)?.first_name ?? "", last: one(m.players)?.last_name ?? "", club: one(one(m.players)?.clubs)?.name ?? "", starter: m.is_starter, captain: m.is_captain }));
    } else {
      const { data } = await db.from("matchday_squad_snapshots").select("player_id,position,is_starter,is_captain,players(first_name,last_name),clubs(name)").eq("matchday_id", selected.id).eq("gamer_id", id);
      members = (data ?? []).map((m) => ({ player_id: m.player_id, position: m.position, first: one(m.players)?.first_name ?? "", last: one(m.players)?.last_name ?? "", club: one(m.clubs)?.name ?? "", starter: m.is_starter, captain: m.is_captain }));
    }
  }
  const sorted = (list: Member[]) => [...list].sort((a, b) => order.indexOf(a.position) - order.indexOf(b.position) || a.last.localeCompare(b.last));
  const starters = sorted(members.filter((m) => m.starter));
  const bench = sorted(members.filter((m) => !m.starter));
  const captain = members.find((m) => m.captain);
  const { data: play } = squad && selected ? await db.from("bonus_plays").select("bonus_id").eq("squad_id", squad.id).eq("matchday_id", selected.id).maybeSingle() : { data: null };

  const [{ data: freeTransfers }, { data: orders }, { data: capRows }, { data: bonusRows }] = squad ? await Promise.all([
    db.from("direct_transfers").select("id,created_at,sold_value,bought_value,tax,status,sold:players!direct_transfers_sold_player_id_fkey(first_name,last_name),bought:players!direct_transfers_bought_player_id_fkey(first_name,last_name)").eq("squad_id", squad.id).order("created_at", { ascending: false }).limit(8),
    db.from("mercado_orders").select("id,created_at,submitted_sold_value,submitted_bought_value,submitted_tax,fixed_commission,status,sold:players!mercado_orders_sold_player_id_fkey(first_name,last_name),bought:players!mercado_orders_bought_player_id_fkey(first_name,last_name)").eq("squad_id", squad.id).order("created_at", { ascending: false }).limit(8),
    db.from("captain_assignments").select("player_id,matchday_id").eq("squad_id", squad.id),
    season ? db.from("bonus_plays").select("bonus_id").eq("squad_id", squad.id).eq("season_id", season.id) : Promise.resolve({ data: [] as { bonus_id: string }[] }),
  ]) : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];
  const dayIds = new Set((days ?? []).map((d) => d.id));
  const capCount = new Map<string, number>();
  for (const row of capRows ?? []) if (dayIds.has(row.matchday_id)) capCount.set(row.player_id, (capCount.get(row.player_id) ?? 0) + 1);
  const playerName = new Map(members.map((m) => [m.player_id, `${m.first[0] ?? ""}. ${m.last}`]));
  const transfers = [
    ...(freeTransfers ?? []).map((t) => ({ id: t.id, kind: "Libre", at: t.created_at, from: one(t.sold), to: one(t.bought), fromValue: Number(t.sold_value), toValue: Number(t.bought_value), delta: Number(t.sold_value) - Number(t.bought_value) - Number(t.tax), status: t.status })),
    ...(orders ?? []).map((o) => ({ id: o.id, kind: "Mercato", at: o.created_at, from: one(o.sold), to: one(o.bought), fromValue: Number(o.submitted_sold_value), toValue: Number(o.submitted_bought_value), delta: Number(o.submitted_sold_value) - Number(o.submitted_bought_value) - Number(o.submitted_tax) - Number(o.fixed_commission), status: o.status })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
  const name = (p: { first_name: string; last_name: string } | null) => p ? `${p.first_name?.[0] ?? ""}. ${p.last_name}` : "—";
  const banned = Boolean(profile.banned_at);

  const row = (m: Member) => <div key={m.player_id} className="ad-counter-row" style={{ padding: "6px 8px", background: "#f7f9fc", borderRadius: 6, marginBottom: 4 }}>
    <span style={{ display: "inline-flex", gap: 10, alignItems: "center" }}><PositionBadge position={m.position} />{/* eslint-disable-next-line @next/next/no-img-element */}<img className="ad-crest" src={getJerseyImage(m.club)} alt="" />{m.first[0]}. {m.last}</span></div>;

  return (
    <main>
      <Crumbs items={[{ label: "⌂", href: "/admin" }, { label: "Managers", href: "/admin/managers" }, { label: profile.username }]} />
      <div className="ad-section"><PageHeader title={<span style={{ display: "inline-flex", gap: 12, alignItems: "center" }}>{profile.username}{banned && <Chip tone="bad">Banni</Chip>}</span>} /></div>
      <div className="ad-grid-2" style={{ gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)" }}>
        <div className="ad-stack">
          <Card title="Profil">
            <ActionForm action={updateManagerProfile} submitLabel="Enregistrer" >
              <input type="hidden" name="managerId" value={id} />
              <div className="ad-form-row" style={{ alignItems: "start" }}>
                <div style={{ flex: "0 0 150px", display: "grid", gap: 8, justifyItems: "center" }}>
                  <div className="ad-dropzone" style={{ width: 150, height: 150 }}>{profile.avatar_url ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={profile.avatar_url} alt="" style={{ width: 96, height: 96, borderRadius: "50%", objectFit: "cover" }} /> : <span>Pas d’avatar</span>}</div>
                  <label className="ad-field--check" style={{ color: "#e5141b" }}><input type="checkbox" name="removeAvatar" value="1" disabled={!profile.avatar_url} /> Retirer</label>
                </div>
                <div className="ad-form" style={{ flex: "1 1 340px" }}>
                  <div className="ad-form-row">
                    <label className="ad-field"><span>Pseudo</span><input className="ad-input" name="username" defaultValue={profile.username} required minLength={3} maxLength={32} /></label>
                    <label className="ad-field"><span>Club de cœur</span><select className="ad-select" name="favorite_club_id" defaultValue={profile.favorite_club_id ?? ""}><option value="">Aucun</option>{(clubs ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
                  </div>
                  <div className="ad-form-row">
                    <label className="ad-field"><span>Biographie courte</span><input className="ad-input" name="bio" defaultValue={profile.bio ?? ""} maxLength={80} /></label>
                    <label className="ad-field"><span>Pays / région</span><input className="ad-input" name="country" defaultValue={profile.country ?? ""} maxLength={80} /></label>
                  </div>
                </div>
              </div>
            </ActionForm>
            <div className="ad-form-actions" style={{ marginTop: 16 }}>
<>
                <ConfirmAction action={deleteManager} fields={{ managerId: id }} small={false} variant="danger" label="Supprimer le compte" message="Supprimer ce compte ? S’il a un historique de jeu, il sera anonymisé et verrouillé." confirmLabel="Supprimer" />
                <ConfirmAction action={resetManager} fields={{ managerId: id }} small={false} variant="ghost" label="Réinitialiser le compte" message="Réinitialiser ce compte ? L’équipe est vidée (à reconstruire), le budget revient au budget initial, le compte bloqué est conservé." confirmLabel="Réinitialiser" disabled={!squad} />
                {banned ? <ConfirmAction action={unbanManager} fields={{ managerId: id }} small={false} variant="outline" label="Débannir" message="Réactiver ce compte ?" confirmLabel="Débannir" />
                  : <Modal size="sm" triggerClassName="ad-btn ad-btn--danger-outline" trigger="Bannir" title="Bannir ce manager"><ActionForm action={banManager} submitLabel="Bannir" toast><input type="hidden" name="managerId" value={id} /><label className="ad-field"><span>Motif</span><input className="ad-input" name="reason" required minLength={3} maxLength={200} placeholder="Ex. multi-comptes" /></label></ActionForm></Modal>}
              </>
            </div>
          </Card>

          <div className="ad-grid-2">
            <Card title="Budget"><div className="ad-counter-row"><b style={{ fontSize: 26, color: Number(finance?.budget ?? 0) < 0 ? "#c4161c" : undefined }}>{formatCompactEuro(Number(finance?.budget ?? 0))}</b>{finance && <Modal size="sm" triggerClassName="ad-btn ad-btn--ghost ad-btn--sm" trigger="Corriger" title="Corriger le budget"><ActionForm action={adjustFinance} submitLabel="Corriger" toast><input type="hidden" name="managerId" value={id} /><input type="hidden" name="kind" value="budget" /><label className="ad-field"><span>Nouveau montant (€)</span><input className="ad-input" type="number" name="value" step="0.01" min="0" defaultValue={Number(finance.budget)} required /></label><label className="ad-field"><span>Motif</span><input className="ad-input" name="reason" required minLength={5} maxLength={300} /></label></ActionForm></Modal>}</div></Card>
            <Card title="Compte bloqué"><div className="ad-counter-row"><b style={{ fontSize: 26 }}>{formatCompactEuro(Number(finance?.blocked_account ?? 0))}</b>{finance && <Modal size="sm" triggerClassName="ad-btn ad-btn--ghost ad-btn--sm" trigger="Corriger" title="Corriger le compte bloqué"><ActionForm action={adjustFinance} submitLabel="Corriger" toast><input type="hidden" name="managerId" value={id} /><input type="hidden" name="kind" value="blocked" /><label className="ad-field"><span>Nouveau montant (€)</span><input className="ad-input" type="number" name="value" step="0.01" min="0" defaultValue={Number(finance.blocked_account)} required /></label><label className="ad-field"><span>Motif</span><input className="ad-input" name="reason" required minLength={5} maxLength={300} /></label></ActionForm></Modal>}</div></Card>
          </div>

          <Card title={<span style={{ display: "flex", justifyContent: "space-between", width: "100%" }}><span>Équipe {squad ? `· ${squad.name}` : ""}</span>{selected && <span className="ad-pager"><Link href={index > 0 ? `?day=${selectable[index - 1].id}` : "#"} aria-label="Journée précédente">‹</Link><b>J{selected.number}{selected.id === liveDay?.id ? " (en cours)" : ""}</b><Link href={index < selectable.length - 1 ? `?day=${selectable[index + 1].id}` : "#"} aria-label="Journée suivante">›</Link></span>}</span>}>
            {squad && members.length ? (
              <div className="ad-stack">
                <div className="ad-grid-2"><div className="ad-field"><span>Capitaine</span><div className="ad-note ad-note--info">{captain ? `${captain.first[0]}. ${captain.last}` : "—"}</div></div><div className="ad-field"><span>Bonus</span><div className="ad-note ad-note--info">{bonusCatalogue.find((b) => b.id === play?.bonus_id)?.title ?? "Aucun"}</div></div></div>
                <div className="ad-grid-2"><div><p className="ad-muted">Titulaires</p>{starters.map(row)}</div><div><p className="ad-muted">Remplaçants</p>{bench.map(row)}</div></div>
              </div>
            ) : <p className="ad-empty">{squad ? "Aucune composition pour cette journée." : "Ce manager n’a pas encore créé son équipe."}</p>}
          </Card>
        </div>

        <div className="ad-stack">
          <Card title="Connexion & sécurité">
            <div className="ad-stack" style={{ gap: 14 }}>
              <div className="ad-counter-row"><div><small className="ad-muted">Adresse e-mail</small><div><b>{masked}</b> {auth.user?.email_confirmed_at && <span style={{ color: "#1b8a2a" }}>✓</span>}</div></div><ActionForm action={resendVerification} submitLabel="Renvoyer le mail de vérification" submitClassName="ad-btn ad-btn--outline ad-btn--sm" className="ad-inline-form"><input type="hidden" name="managerId" value={id} /></ActionForm></div>
              <div className="ad-counter-row"><div><small className="ad-muted">Mot de passe</small><div><b>************</b></div></div><ActionForm action={sendPasswordReset} submitLabel="Réinitialiser le mot de passe" submitClassName="ad-btn ad-btn--outline ad-btn--sm" className="ad-inline-form"><input type="hidden" name="managerId" value={id} /></ActionForm></div>
              <p className="ad-muted" style={{ fontSize: 12 }}>Dernière connexion : {formatDateTime(profile.last_seen_at ?? auth.user?.last_sign_in_at)}</p>
            </div>
          </Card>
          <Card title="Comptes liés">
            {(linked ?? []).length ? (linked ?? []).map((l) => <div key={l.id} className="ad-counter-row"><span style={{ display: "inline-flex", gap: 12, alignItems: "center" }}><Link href={`/admin/managers/${l.id}`}>{l.username}</Link><span className="ad-muted">Même IP</span><span className="ad-muted">créé le {formatDateTime(l.created_at).slice(0, 8)}</span>{l.banned_at && <Chip tone="bad">Banni</Chip>}</span></div>) : <p className="ad-muted">Aucun autre compte n’a utilisé la même adresse récemment.</p>}
          </Card>
          <Card title="Transferts" flush>
            {transfers.length ? transfers.map((t) => (
              <div key={t.id} className="ad-xfer">
                <div className="ad-xfer-top"><Chip tone={t.kind === "Mercato" ? "info" : "off"}>{t.kind}</Chip><span className="ad-muted">{formatDateTime(t.at)}</span><b className="ad-xfer-amount" style={{ color: t.status === "cancelled" ? "#6b6f76" : t.delta < 0 ? "#c4161c" : "#1b8a2a" }}>{t.status === "cancelled" ? "annulé" : `${t.delta > 0 ? "+" : ""}${formatCompactEuro(t.delta)}`}</b></div>
                <div className="ad-xfer-body">{name(t.from)} <span className="ad-muted">({formatCompactEuro(t.fromValue)})</span> → {name(t.to)} <span className="ad-muted">({formatCompactEuro(t.toValue)})</span></div>
              </div>
            )) : <p className="ad-empty">Aucun transfert.</p>}
          </Card>
          <div className="ad-grid-2">
            <Card title="Compteur capitanat">
              {members.filter((m) => m.starter || (capCount.get(m.player_id) ?? 0) > 0).map((m) => (
                <div key={m.player_id} className="ad-counter-row"><span>{m.first[0]}. {m.last}</span><span style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>{capCount.get(m.player_id) ?? 0}/{marketfootRulesConfig.captain.maxUsesPerChampionship}<ConfirmAction action={resetCaptainCounter} fields={{ managerId: id, playerId: m.player_id }} label="Réinitialiser" variant="ghost" message={`Réinitialiser le compteur capitanat de ${playerName.get(m.player_id)} ?`} confirmLabel="Réinitialiser" /></span></div>
              ))}
              {!members.length && <p className="ad-muted">—</p>}
            </Card>
            <Card title="Compteur Bonus">
              {bonusCatalogue.map((bonus) => {
                const max = settings.bonus.list.find((b) => b.id === bonus.id)?.maxPerSeason ?? 0;
                const used = (bonusRows ?? []).filter((r) => r.bonus_id === bonus.id).length;
                return <div key={bonus.id} className="ad-counter-row"><span>{bonus.title}</span><span style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>{used}/{max}<ConfirmAction action={resetBonusCounter} fields={{ managerId: id, bonusId: bonus.id }} label="Réinitialiser" variant="ghost" message={`Réinitialiser le compteur du bonus « ${bonus.title} » ?`} confirmLabel="Réinitialiser" disabled={used === 0} /></span></div>;
              })}
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
