"use client";

import { useActionState, useRef, useState } from "react";

import { signIn, signInWithGoogle, signUp, type AuthActionState } from "./actions";

const initialState: AuthActionState = {};

export function AuthForm({ devUser }: { devUser?: { label: string; email: string; password: string } }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(mode === "signin" ? signIn : signUp, initialState);

  return (
    <section className="auth-card" aria-labelledby="auth-title">
      <p className="eyebrow">MARKETFOOT</p>
      <h1 id="auth-title">{mode === "signin" ? "Connexion" : "Créer un compte"}</h1>
      <p>{mode === "signin" ? "Accédez à votre équipe et à la Ligue 1." : "Créez votre identité de joueur MARKETFOOT."}</p>
      <form ref={formRef} action={action} noValidate className="auth-form">
        {mode === "signup" && <label>Pseudo<input name="username" autoComplete="username" minLength={3} maxLength={32} required aria-describedby="username-help"/><small id="username-help">3 à 32 caractères : lettres, chiffres, espaces, tirets ou tirets bas.</small></label>}
        <label>Adresse e-mail<input name="email" type="email" autoComplete="email" required /></label>
        <label>Mot de passe<input name="password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} required /></label>
        {state.error && <p className="form-error" role="alert">{state.error}</p>}
        {state.message && <p className="form-success" role="status">{state.message}</p>}
        <button type="submit" disabled={pending}>{pending ? "Patientez…" : mode === "signin" ? "Se connecter" : "Créer mon compte"}</button>
      </form>
      {devUser && mode === "signin" && (
        <button className="secondary-button" type="button" data-dev-user onClick={() => {
          const form = formRef.current; if (!form) return;
          (form.elements.namedItem("email") as HTMLInputElement).value = devUser.email;
          (form.elements.namedItem("password") as HTMLInputElement).value = devUser.password;
        }}>Utiliser le compte test ({devUser.label})</button>
      )}
      <form action={signInWithGoogle}><button className="secondary-button" type="submit">Continuer avec Google</button></form>
      <button className="text-button" type="button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
        {mode === "signin" ? "Créer un compte" : "J’ai déjà un compte"}
      </button>
    </section>
  );
}
