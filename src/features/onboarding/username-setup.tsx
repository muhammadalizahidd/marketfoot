"use client";
import { useActionState } from "react";
import { completeOAuthProfile, type CreateSquadState } from "./actions";

export function UsernameSetup() {
  const [state, action, pending] = useActionState(completeOAuthProfile, {} as CreateSquadState);
  return <section className="empty-state" aria-labelledby="username-title"><p className="eyebrow">Dernière étape</p><h1 id="username-title">Choisissez votre pseudo</h1><p>Votre pseudo est requis avant de créer votre équipe MARKETFOOT.</p><form action={action} className="auth-form" noValidate><label>Pseudo<input name="username" minLength={3} maxLength={32} autoComplete="username" required/><small>3 à 32 caractères : lettres, chiffres, espaces, tirets ou tirets bas.</small></label>{state.error && <p className="form-error" role="alert">{state.error}</p>}<button className="primary-action" type="submit" disabled={pending}>{pending ? "Enregistrement…" : "Continuer"}</button></form></section>;
}
