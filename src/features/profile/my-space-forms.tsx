"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";

import { getJerseyImage } from "@/lib/jersey-map";
import type { Settings } from "@/data/repositories/gamer-repository";
import { changeEmail, changePassword, checkUsername, requestDeletion, setTheme, updateProfile, uploadAvatar, type ProfileActionState } from "./actions";

const regions = ["France - Île de France", "France - Auvergne-Rhône-Alpes", "France - Bretagne", "France - Grand Est", "France - Hauts-de-France", "France - Normandie", "France - Nouvelle-Aquitaine", "France - Occitanie", "France - Pays de la Loire", "France - Provence-Alpes-Côte d’Azur", "France - Outre-mer", "Belgique", "Suisse", "Luxembourg", "Canada", "Autre pays"];
const chevron = <svg className="sp-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>;

/** Profile card: avatar upload, pseudo (live availability), favourite club, short bio and region. Changes are saved as you go. */
export function ProfileForm({ settings }: { settings: Settings }) {
  const [state, save, pending] = useActionState<ProfileActionState, FormData>(updateProfile, {});
  const [avatar, uploadAction, uploading] = useActionState<ProfileActionState, FormData>(uploadAvatar, {});
  const [availability, setAvailability] = useState<{ available: boolean; message?: string } | null>(settings.username ? { available: true } : null);
  const [, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const avatarForm = useRef<HTMLFormElement>(null);
  const submit = () => formRef.current?.requestSubmit();
  useEffect(() => { /* keep availability green only for the saved pseudo */ }, []);
  const club = settings.clubs.find((item) => item.id === settings.favoriteClubId);
  return (
    <section id="profil" className="sp-card">
      <h2>Profil {pending || uploading ? <small>Enregistrement…</small> : state.message || avatar.message ? <small className="is-up">{state.message ?? avatar.message}</small> : null}</h2>
      <div className="sp-profile">
        <form ref={avatarForm} action={uploadAction} className="sp-drop">
          <label>
            {settings.avatarUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={settings.avatarUrl} alt="Ma photo de profil" /> : (
              <>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 18a5 5 0 1 1 1-9.9A6 6 0 0 1 19 10a4 4 0 0 1-1 8" /><path d="m12 12v8m0 0-3-3m3 3 3-3" /></svg>
                <span>Choisis un fichier<br />ou dépose le ici</span>
              </>
            )}
            <input type="file" name="avatar" accept="image/png,image/jpeg,image/webp" onChange={() => avatarForm.current?.requestSubmit()} />
          </label>
          {avatar.error && <p role="alert" className="is-down">{avatar.error}</p>}
        </form>

        <form ref={formRef} action={save} className="sp-fields">
          <label className="f-pseudo"><span>Pseudo</span>
            <div className="sp-input">
              <input name="username" defaultValue={settings.username} maxLength={32} onChange={(e) => { const v = e.target.value; if (v === settings.username) { setAvailability({ available: true }); return; } setAvailability(null); startTransition(async () => setAvailability(await checkUsername(v))); }} onBlur={(e) => { if (e.target.value !== settings.username && availability?.available) submit(); }} />
              {availability && <em className={availability.available ? "is-up" : "is-down"}>{availability.available ? <>Disponible ✓</> : availability.message ?? "Déjà pris"}</em>}
            </div>
          </label>
          <label className="f-club"><span>Club de coeur</span>
            <div className="sp-input sp-select">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {club && <img src={getJerseyImage(club.name)} alt="" width={20} height={20} />}
              <select name="favoriteClubId" defaultValue={settings.favoriteClubId ?? ""} onChange={submit}><option value="">Aucun</option>{settings.clubs.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{chevron}
            </div>
          </label>
          <label className="f-bio"><span>Biographie courte</span>
            <div className="sp-input"><input name="bio" defaultValue={settings.bio} maxLength={80} placeholder="Manager du dimanche" onBlur={submit} /></div>
          </label>
          <label className="f-country"><span>Pays / région</span>
            <div className="sp-input sp-select"><select name="country" defaultValue={settings.country} onChange={submit}><option value="">Non renseigné</option>{regions.map((item) => <option key={item}>{item}</option>)}</select>{chevron}</div>
          </label>
          {state.error && <p role="alert" className="is-down sp-error">{state.error}</p>}
        </form>
      </div>
    </section>
  );
}

function mask(email: string) {
  const [local, domain] = email.split("@");
  return local.length <= 3 ? `${local[0] ?? ""}***@${domain}` : `${local.slice(0, 2)}${"*".repeat(Math.max(3, local.length - 3))}${local.slice(-1)}@${domain}`;
}

/** Connexion & sécurité: masked e-mail and password with inline "Modifier" forms. */
export function SecuritySection({ email, confirmed }: { email: string; confirmed: boolean }) {
  const [editing, setEditing] = useState<"email" | "password" | null>(null);
  const [emailState, emailAction, emailPending] = useActionState<ProfileActionState, FormData>(changeEmail, {});
  const [passState, passAction, passPending] = useActionState<ProfileActionState, FormData>(changePassword, {});
  return (
    <section id="securite" className="sp-card">
      <h2>Connexion &amp; sécurité</h2>
      <div className="sp-row">
        <div><b>Adresse e-mail</b><p>{mask(email)} {confirmed && <i className="is-up">✓</i>}</p></div>
        <button type="button" onClick={() => setEditing(editing === "email" ? null : "email")}>Modifier</button>
      </div>
      {editing === "email" && (
        <form action={emailAction} className="sp-inline">
          <input type="email" name="email" placeholder="Nouvelle adresse e-mail" required autoComplete="email" />
          <button type="submit" disabled={emailPending}>Envoyer la confirmation</button>
          {(emailState.error || emailState.message) && <p role="status" className={emailState.error ? "is-down" : "is-up"}>{emailState.error ?? emailState.message}</p>}
        </form>
      )}
      <div className="sp-row">
        <div><b>Mot de passe</b><p>*************</p></div>
        <button type="button" onClick={() => setEditing(editing === "password" ? null : "password")}>Modifier</button>
      </div>
      {editing === "password" && (
        <form action={passAction} className="sp-inline">
          <input type="password" name="password" placeholder="Nouveau mot de passe (8 caractères min.)" required minLength={8} autoComplete="new-password" />
          <input type="password" name="confirm" placeholder="Confirmer le mot de passe" required minLength={8} autoComplete="new-password" />
          <button type="submit" disabled={passPending}>Enregistrer</button>
          {(passState.error || passState.message) && <p role="status" className={passState.error ? "is-down" : "is-up"}>{passState.error ?? passState.message}</p>}
        </form>
      )}
    </section>
  );
}

/** Thème: light / dark / automatic, saved to the profile and a cookie. */
export function ThemeSection({ theme }: { theme: Settings["theme"] }) {
  const options: [Settings["theme"], string][] = [["light", "Mode clair"], ["dark", "Mode sombre"], ["auto", "Mode automatique (système)"]];
  return (
    <section id="theme" className="sp-card">
      <h2>Thème</h2>
      <form action={setTheme} className="sp-radios">
        {options.map(([value, label]) => (
          <label key={value}><input type="radio" name="theme" value={value} defaultChecked={theme === value} onChange={(e) => e.currentTarget.form?.requestSubmit()} /><span className="dot" /><b>{label}</b></label>
        ))}
      </form>
    </section>
  );
}

/** "Supprimer mon compte": confirmation by typing the pseudo; the account is deactivated (see requestDeletion). */
export function DeleteAccount({ username }: { username: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ProfileActionState, FormData>(requestDeletion, {});
  return (
    <>
      <button type="button" className="sp-danger" onClick={() => setOpen(true)}>Supprimer mon compte</button>
      {open && (
        <div className="sp-modal" role="dialog" aria-modal="true" aria-labelledby="del-title">
          <form action={action}>
            <h3 id="del-title">Supprimer mon compte</h3>
            <p>Votre compte sera désactivé immédiatement et planifié pour suppression. Vos données de jeu sont conservées selon la politique de confidentialité. Saisissez votre pseudo <b>{username}</b> pour confirmer.</p>
            <input name="confirm" autoComplete="off" aria-label="Pseudo de confirmation" />
            {state.error && <p role="alert" className="is-down">{state.error}</p>}
            <div><button type="button" onClick={() => setOpen(false)}>Annuler</button><button type="submit" className="danger" disabled={pending}>Supprimer</button></div>
          </form>
        </div>
      )}
    </>
  );
}
