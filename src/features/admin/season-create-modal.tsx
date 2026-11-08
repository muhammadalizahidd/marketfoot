"use client";

import { useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";

import { Feedback, Modal, useKeepValuesAction } from "@/components/admin/client";
import { createSeason } from "./season-actions";

type Club = { id: string; name: string; icon: string };
type SeasonOption = { id: string; name: string; clubIds: string[] };

/** "Créer une saison": 1 Informations · 2 Partir d’une saison existante · 3 Choix des équipes (UI/Admin frames). */
export function SeasonCreateModal({ seasons, clubs, defaultStart, defaultEnd }: { seasons: SeasonOption[]; clubs: Club[]; defaultStart: string; defaultEnd: string }) {
  return (
    <Modal trigger={<><Plus size={18} aria-hidden="true" />Créer une saison</>} title="Créer une saison">
      <CreateForm seasons={seasons} clubs={clubs} defaultStart={defaultStart} defaultEnd={defaultEnd} />
    </Modal>
  );
}

function CreateForm({ seasons, clubs, defaultStart, defaultEnd }: { seasons: SeasonOption[]; clubs: Club[]; defaultStart: string; defaultEnd: string }) {
  const { state, onSubmit, pending } = useKeepValuesAction(createSeason);
  const [cloneFrom, setCloneFrom] = useState("");
  const [takeTeams, setTakeTeams] = useState(false);
  const [takeSquads, setTakeSquads] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [newTeam, setNewTeam] = useState("");
  const [added, setAdded] = useState<string[]>([]);
  const formRef = useRef<HTMLFormElement>(null);
  const source = useMemo(() => seasons.find((season) => season.id === cloneFrom), [seasons, cloneFrom]);
  const count = selected.size + added.length;
  const addTeam = () => { const name = newTeam.trim().replace(/\s+/g, " "); if (name.length < 2) return; const known = clubs.find((club) => club.name.toLowerCase() === name.toLowerCase()); if (known) setSelected((current) => new Set(current).add(known.id)); else if (!added.some((entry) => entry.toLowerCase() === name.toLowerCase())) setAdded((current) => [...current, name]); setNewTeam(""); };

  const toggleTeams = (checked: boolean, from = source) => {
    setTakeTeams(checked);
    if (checked && from) setSelected(new Set(from.clubIds));
  };
  const toggle = (id: string) => setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  return (
    <form ref={formRef} onSubmit={onSubmit} className="ad-form">
      <h3 className="ad-section-title">1. Informations</h3>
      <div className="ad-form-row">
        <label className="ad-field"><span>Nom</span><input className="ad-input" name="name" placeholder="Nom" required minLength={3} maxLength={60} /></label>
        <label className="ad-field"><span>Début</span><input className="ad-input" type="date" name="starts_on" defaultValue={defaultStart} required /></label>
        <label className="ad-field"><span>Fin</span><input className="ad-input" type="date" name="ends_on" defaultValue={defaultEnd} required /></label>
      </div>

      <h3 className="ad-section-title">2. Partir d’une saison existante</h3>
      <div className="ad-form-row" style={{ alignItems: "start" }}>
        <select className="ad-select" name="cloneFrom" value={cloneFrom} aria-label="Saison existante" onChange={(event) => { const id = event.target.value; setCloneFrom(id); if (takeTeams) toggleTeams(true, seasons.find((season) => season.id === id)); if (!id) setTakeSquads(false); }}>
          <option value="">Aucune</option>
          {seasons.map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}
        </select>
        <div className="ad-form" style={{ gap: 10 }}>
          <label className="ad-field--check"><input type="checkbox" disabled={!cloneFrom} checked={takeTeams} onChange={(event) => toggleTeams(event.target.checked)} /> Reprendre les équipes</label>
          <label className="ad-field--check"><input type="checkbox" name="takeSquads" disabled={!cloneFrom} checked={takeSquads} onChange={(event) => setTakeSquads(event.target.checked)} /> Reprendre les effectifs</label>
          <select className="ad-select" name="valueMode" disabled={!takeSquads} defaultValue="end" aria-label="Valeur des joueurs">
            <option value="end">Valeur de fin de saison</option>
            <option value="start">Valeur des joueurs de début de saison</option>
          </select>
        </div>
      </div>

      <div className="ad-head" style={{ margin: 0, minHeight: 0 }}>
        <h3 className="ad-section-title">3. Choix des équipes</h3>
        <span className="ad-count-ok">{count} équipe{count > 1 ? "s" : ""} sélectionnée{count > 1 ? "s" : ""}</span>
      </div>
      <div className="ad-team-grid">
        {clubs.map((club) => (
          <label key={club.id} className="ad-team-pick">
            <input type="checkbox" name="club" value={club.id} checked={selected.has(club.id)} onChange={() => toggle(club.id)} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={club.icon} alt="" />
            <span>{club.name}</span>
          </label>
        ))}
        {added.map((name) => (
          <label key={name} className="ad-team-pick is-new">
            <input type="checkbox" name="newTeam" value={name} checked onChange={() => setAdded((current) => current.filter((entry) => entry !== name))} />
            <span className="ad-team-blank" aria-hidden="true" />
            <span>{name}</span>
          </label>
        ))}
      </div>
      <div className="ad-team-add">
        <input className="ad-input ad-input--search" value={newTeam} onChange={(event) => setNewTeam(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addTeam(); } }} placeholder="Ajouter une équipe" aria-label="Ajouter une équipe" />
        {newTeam.trim().length >= 2 && <button type="button" className="ad-btn ad-btn--ghost" onClick={addTeam}>Ajouter « {newTeam.trim()} »</button>}
      </div>

      <Feedback state={state} />
      <div className="ad-form-actions">
        <button type="submit" name="intent" value="draft" className="ad-btn ad-btn--ghost" disabled={pending}>Enregistrer en tant que brouillon</button>
        <button type="submit" name="intent" value="create" className="ad-btn" disabled={pending || count < 2}>{pending ? "Création…" : "Créer"}</button>
      </div>
    </form>
  );
}
