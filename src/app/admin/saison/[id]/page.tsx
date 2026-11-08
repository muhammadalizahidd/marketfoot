import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { z } from "zod";

import { ActionForm, ConfirmAction, SearchPicker } from "@/components/admin/client";
import { Card, Chip, Crumbs, PageHeader, PhaseStepper } from "@/components/admin/ui";
import { toDateInput } from "@/lib/admin/format";
import { getJerseyImage } from "@/lib/jersey-map";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { addSeasonClub, finishSeason, removeSeasonClub, saveClub, saveRoster, saveSeasonInfo, removeSeasonPlayer, validateSeason } from "@/features/admin/season-actions";
import { RosterAdder, type PlayerOption } from "@/features/admin/roster-adder";
import { SeasonCreateModal } from "@/features/admin/season-create-modal";
import { statusLabels } from "@/lib/admin/season-status";

const positions = [["GK", "G"], ["DF", "D"], ["MF", "M"], ["FW", "A"]] as const;
const lifecycle = [
  { id: "draft", label: "Création saison" }, { id: "pending_validation", label: "En attente de validation" },
  { id: "active", label: "Saison en cours" }, { id: "finished", label: "Terminer la saison" },
];

export default async function SeasonDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ club?: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const { club: clubParam } = await searchParams;
  const db = createSupabaseAdminClient();
  const [{ data: season }, { data: links }, { data: allClubs }, { data: allSeasons }, { data: roster }, { data: everyone }] = await Promise.all([
    db.from("seasons").select("*").eq("id", id).maybeSingle(),
    db.from("season_clubs").select("club_id").eq("season_id", id),
    db.from("clubs").select("id,name,short_name,crest_url").order("name"),
    db.from("seasons").select("id,name").order("starts_on", { ascending: false }),
    db.from("season_players").select("player_id,club_id,start_value").eq("season_id", id),
    db.from("players").select("id,first_name,last_name,position").order("last_name"),
  ]);
  if (!season) notFound();
  const inSeason = new Set((links ?? []).map((link) => link.club_id));
  const clubs = (allClubs ?? []).filter((club) => inSeason.has(club.id));
  const addable = (allClubs ?? []).filter((club) => !inSeason.has(club.id));
  const selected = clubs.find((club) => club.id === clubParam) ?? clubs[0];
  const editable = season.status !== "finished";
  const icon = (club: { name: string; crest_url: string | null }) => club.crest_url ?? getJerseyImage(club.name);
  const clubById = new Map((allClubs ?? []).map((club) => [club.id, club]));
  const playerById = new Map((everyone ?? []).map((player) => [player.id, player]));
  const rosterRows = (roster ?? []).filter((row) => row.club_id === selected?.id).map((row) => ({ ...row, player: playerById.get(row.player_id) })).filter((row) => row.player)
    .sort((a, b) => positions.findIndex(([p]) => p === a.player!.position) - positions.findIndex(([p]) => p === b.player!.position) || a.player!.last_name.localeCompare(b.player!.last_name));
  const seasonClubOfPlayer = new Map((roster ?? []).map((row) => [row.player_id, row.club_id]));
  const pickerOptions: PlayerOption[] = (everyone ?? []).filter((player) => seasonClubOfPlayer.get(player.id) !== selected?.id).slice(0, 800).map((player) => {
    const owner = clubById.get(seasonClubOfPlayer.get(player.id) ?? "");
    return { id: player.id, label: `${player.first_name} ${player.last_name}`.trim(), clubId: owner?.id ?? null, clubName: owner?.name ?? null, icon: owner ? icon(owner) : "/images/jerseys/default.svg" };
  });
  const status = statusLabels[season.status] ?? statusLabels.draft;
  const year = new Date().getFullYear();

  return (
    <main>
      <Crumbs items={[{ label: "⌂", href: "/admin" }, { label: "Saison", href: "/admin/saison" }, { label: season.name }]} />
      <PageHeader title={<span style={{ display: "inline-flex", gap: 12, alignItems: "center" }}>{season.name} <Chip tone={status.tone}>{status.label}</Chip></span>}
        actions={<SeasonCreateModal seasons={(allSeasons ?? []).map((s) => ({ id: s.id, name: s.name, clubIds: s.id === id ? [...inSeason] : [] }))} clubs={(allClubs ?? []).map((c) => ({ id: c.id, name: c.name, icon: icon(c) }))} defaultStart={`${year}-08-01`} defaultEnd={`${year + 1}-06-01`} />} />
      <div className="ad-stack" style={{ marginBottom: 20 }}><PhaseStepper steps={lifecycle} active={season.status} /></div>

      <div className="ad-grid-2" style={{ gridTemplateColumns: "minmax(0, 5fr) minmax(0, 6fr)" }}>
        <Card>
          <div className="ad-stack">
            <ActionForm action={saveSeasonInfo} submitLabel="Enregistrer" secondary={editable && <button type="submit" name="asDraft" value="1" className="ad-btn ad-btn--ghost">Enregistrer en tant que brouillon</button>} disabled={!editable}>
              <input type="hidden" name="seasonId" value={season.id} />
              <div className="ad-form-row">
                <label className="ad-field"><span>Nom</span><input className="ad-input" name="name" defaultValue={season.name} disabled={!editable} required minLength={3} /></label>
                <label className="ad-field"><span>Début</span><input className="ad-input" type="date" name="starts_on" defaultValue={toDateInput(season.starts_on)} disabled={!editable} required /></label>
                <label className="ad-field"><span>Fin</span><input className="ad-input" type="date" name="ends_on" defaultValue={toDateInput(season.ends_on)} disabled={!editable} required /></label>
              </div>
            </ActionForm>

            <h2 className="ad-section-title" style={{ fontSize: 20 }}>Équipes <span className="ad-muted" style={{ fontSize: 14 }}>({clubs.length})</span></h2>
            <div className="ad-team-grid">
              {clubs.map((club) => (
                <div key={club.id} className={`ad-team-row${club.id === selected?.id ? " is-selected" : ""}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="ad-crest" src={icon(club)} alt="" />
                  <Link href={`/admin/saison/${id}?club=${club.id}`} style={{ flex: 1, textDecoration: "none" }}>{club.name}</Link>
                  <Link className="ad-icon-btn" href={`/admin/saison/${id}?club=${club.id}`} aria-label={`Modifier ${club.name}`}><Pencil /></Link>
                  {editable && <ConfirmAction action={removeSeasonClub} fields={{ seasonId: id, clubId: club.id }} label="×" message={`Retirer ${club.name} de la saison ? Son effectif de la saison sera retiré.`} confirmLabel="Retirer" />}
                </div>
              ))}
            </div>
            {editable && (
              <div style={{ maxWidth: 360, marginLeft: "auto", width: "100%" }}>
                <SearchPicker action={addSeasonClub} name="clubId" hidden={{ seasonId: id }} placeholder="Ajouter une équipe" createLabel="Ajouter une nouvelle équipe" createName="newName"
                  options={addable.map((club) => ({ id: club.id, label: club.name, icon: icon(club) }))} />
              </div>
            )}
          </div>
        </Card>

        <Card>
          {selected ? (
            <div className="ad-stack">
              <ActionForm action={saveClub} submitLabel="Enregistrer l’équipe" disabled={!editable}>
                <input type="hidden" name="clubId" value={selected.id} />
                <input type="hidden" name="seasonId" value={id} />
                <div className="ad-form-row" style={{ alignItems: "end" }}>
                  <label className="ad-dropzone" style={{ flex: "0 0 120px" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={icon(selected)} alt="" />
                    <span>Choisis un fichier<br />ou dépose le ici</span>
                    <input type="file" name="crest" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden disabled={!editable} />
                  </label>
                  <label className="ad-field"><span>Nom complet</span><input className="ad-input" name="name" defaultValue={selected.name} disabled={!editable} required /></label>
                  <label className="ad-field"><span>Abréviation</span><input className="ad-input" name="short_name" defaultValue={selected.short_name} disabled={!editable} required maxLength={8} /></label>
                </div>
              </ActionForm>

              <div>
                <div className="ad-roster-head"><span>Poste</span><span>Prénom</span><span>Nom</span><span>Valeur</span><span /></div>
                {editable && <div style={{ display: "flex", justifyContent: "flex-end", padding: "12px 0" }}><RosterAdder seasonId={id} clubId={selected.id} clubName={selected.name} options={pickerOptions} /></div>}
                {rosterRows.map((row) => (
                  <div className="ad-roster-row" key={row.player_id}>
                    <select className="ad-select" style={{ padding: "0 4px", minHeight: 36, width: 56 }} form="roster-form" name={`p.${row.player_id}.position`} defaultValue={row.player!.position} aria-label="Poste" disabled={!editable}>
                      {positions.map(([value, letter]) => <option key={value} value={value}>{letter}</option>)}
                    </select>
                    <input className="ad-input" form="roster-form" name={`p.${row.player_id}.first_name`} defaultValue={row.player!.first_name} aria-label="Prénom" disabled={!editable} />
                    <input className="ad-input" form="roster-form" name={`p.${row.player_id}.last_name`} defaultValue={row.player!.last_name} aria-label="Nom" disabled={!editable} required />
                    <input className="ad-input" form="roster-form" type="number" min={500000} step="any" name={`p.${row.player_id}.value`} defaultValue={Number(row.start_value)} aria-label="Valeur (€)" disabled={!editable} required />
                    {editable ? <ConfirmAction action={removeSeasonPlayer} fields={{ seasonId: id, playerId: row.player_id }} label="×" message={`Retirer ${row.player!.first_name} ${row.player!.last_name} de l’effectif ?`} confirmLabel="Retirer" /> : <span />}
                  </div>
                ))}
                {!rosterRows.length && <p className="ad-empty">Aucun joueur dans cette équipe pour cette saison.</p>}
              </div>
              {editable && (
                <ActionForm id="roster-form" action={saveRoster} submitLabel="Enregistrer l’effectif">
                  <input type="hidden" name="seasonId" value={id} />
                  <input type="hidden" name="clubId" value={selected.id} />
                </ActionForm>
              )}
            </div>
          ) : <p className="ad-empty">Ajoutez une équipe pour composer son effectif.</p>}
        </Card>
      </div>

      <div className="ad-form-actions" style={{ marginTop: 20 }}>
        {season.status === "active" && <ConfirmAction action={finishSeason} fields={{ seasonId: id }} small={false} variant="ghost" label="Terminer la saison" message="Terminer la saison ? Les valeurs de fin de saison sont enregistrées et les points palmarès attribués." confirmLabel="Terminer" />}
        {(season.status === "draft" || season.status === "pending_validation") && <ConfirmAction action={validateSeason} fields={{ seasonId: id }} small={false} variant="primary" label="Valider" message="Valider la saison ? Elle devient la saison en cours et son effectif est appliqué au catalogue des joueurs." confirmLabel="Valider" />}
      </div>
    </main>
  );
}
