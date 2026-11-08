"use client";

import { useActionState } from "react";

import { addFriend, type ProfileActionState } from "./actions";

/** Pseudo search + blue "+" button (Figma "Amis"): adds a manager to the friends list by exact pseudo. */
export function AddFriend() {
  const [state, action, pending] = useActionState<ProfileActionState, FormData>(addFriend, {});
  return (
    <form action={action} className="gp-add" role="search">
      <label>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <input name="username" placeholder="Rechercher un pseudo…" aria-label="Pseudo du manager à ajouter" autoComplete="off" maxLength={32} />
      </label>
      <button type="submit" disabled={pending} aria-label="Ajouter aux amis">+</button>
      {(state.error || state.message) && <p role="status" className={state.error ? "is-down" : "is-up"}>{state.error ?? state.message}</p>}
    </form>
  );
}
