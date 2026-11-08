"use client";

import { useActionState, useRef, useState } from "react";

import { Feedback } from "@/components/admin/client";
import { addSeasonPlayer } from "./season-actions";

export type PlayerOption = { id: string; label: string; clubId: string | null; clubName: string | null; icon: string };

/** "Ajouter un joueur": search an existing player (move confirmation when he belongs to another team) or create a new one. */
export function RosterAdder({ seasonId, clubId, clubName, options }: { seasonId: string; clubId: string; clubName: string; options: PlayerOption[] }) {
  const [state, action] = useActionState(addSeasonPlayer, {});
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<PlayerOption | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const playerRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const matches = options.filter((option) => option.label.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 12);

  const submit = (playerId: string, confirmMove: boolean) => {
    if (playerRef.current) playerRef.current.value = playerId;
    if (confirmRef.current) confirmRef.current.value = confirmMove ? "true" : "";
    setOpen(false);
    formRef.current?.requestSubmit();
    setQuery("");
  };
  const pick = (option: PlayerOption) => {
    if (option.clubId && option.clubId !== clubId) { setPending(option); setOpen(false); dialogRef.current?.showModal(); return; }
    submit(option.id, false);
  };

  return (
    <form ref={formRef} action={action} className="ad-menu" style={{ width: 340 }}>
      <input type="hidden" name="seasonId" value={seasonId} />
      <input type="hidden" name="clubId" value={clubId} />
      <input ref={playerRef} type="hidden" name="playerId" />
      <input ref={confirmRef} type="hidden" name="confirmMove" />
      <input type="hidden" name="newName" value={query} />
      <input className="ad-input ad-input--search" placeholder="Ajouter un joueur" value={query} aria-label="Ajouter un joueur" role="combobox" aria-expanded={open}
        onFocus={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); setOpen(true); }} onBlur={() => setTimeout(() => setOpen(false), 150)} />
      {open && (
        <div className="ad-menu-list" role="listbox">
          {matches.map((option) => (
            <button type="button" key={option.id} role="option" aria-selected="false" onMouseDown={(event) => event.preventDefault()} onClick={() => pick(option)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="ad-crest" src={option.icon} alt="" /><span>{option.label}</span><em>+</em>
            </button>
          ))}
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => query.trim().length >= 2 && submit("__new__", false)}>
            <span>Ajouter un nouveau joueur{query.trim() ? ` « ${query.trim()} »` : ""}</span><em>+</em>
          </button>
        </div>
      )}
      <Feedback state={state} />
      <dialog ref={dialogRef} className="ad-dialog ad-dialog--sm" aria-label="Confirmation du déplacement">
        <div className="ad-dialog-body">
          <p className="ad-confirm-text">Êtes-vous sûr de vouloir déplacer<br /><b>{pending?.label} [{pending?.clubName}]</b><br />vers [{clubName}]</p>
          <div className="ad-confirm-actions">
            <button type="button" className="ad-btn ad-btn--ghost" onClick={() => { dialogRef.current?.close(); setPending(null); }}>Annuler</button>
            <button type="button" className="ad-btn" onClick={() => { dialogRef.current?.close(); if (pending) submit(pending.id, true); setPending(null); }}>Confirmer</button>
          </div>
        </div>
      </dialog>
    </form>
  );
}
