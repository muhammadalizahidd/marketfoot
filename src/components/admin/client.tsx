"use client";

import { useActionState, useEffect, useId, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";

import { flash } from "./flash";
import type { AdminActionState } from "@/features/admin/actions";

export type AdminAction = (previous: AdminActionState, formData: FormData) => Promise<AdminActionState>;
const initial: AdminActionState = {};

/**
 * Like useActionState, but the form is submitted from an onSubmit handler. React 19 resets a form after its `action` runs
 * — even when the action returned a validation error — which would wipe everything the admin typed.
 */
export function useKeepValuesAction(action: AdminAction, toast = false) {
  const [state, setState] = useState<AdminActionState>(initial);
  const [pending, startTransition] = useTransition();
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const data = new FormData(event.currentTarget, submitter as HTMLElement | null);
    startTransition(async () => {
      const result = await action(initial, data);
      setState(result);
      if (toast) { if (result.error) flash(result.error, "err"); else if (result.success) flash(result.success, "ok"); }
    });
  };
  return { state, onSubmit, pending };
}

export function Feedback({ state }: { state: AdminActionState }) {
  return <>
    {state.error && <p className="ad-note ad-note--err" role="alert">{state.error}</p>}
    {state.success && <p className="ad-note ad-note--ok" role="status">{state.success}</p>}
  </>;
}

/** A form bound to a server action with pending state, error/success feedback and a submit button. */
export function ActionForm({ action, children = null, submitLabel = "Enregistrer", className = "ad-form", secondary, disabled, id, submitClassName = "ad-btn", toast = false }: { action: AdminAction; children?: ReactNode; submitLabel?: string; className?: string; secondary?: ReactNode; disabled?: boolean; id?: string; submitClassName?: string; toast?: boolean }) {
  const { state, onSubmit, pending } = useKeepValuesAction(action, toast);
  return (
    <form id={id} onSubmit={onSubmit} className={className}>
      {children}
      <Feedback state={state} />
      <div className="ad-form-actions">{secondary}<button type="submit" className={submitClassName} disabled={pending || disabled}>{pending ? "Enregistrement…" : submitLabel}</button></div>
    </form>
  );
}

/** GET form that re-submits whenever a select / date changes (text inputs submit on Enter). */
export function AutoSubmitForm({ children, className = "ad-toolbar" }: { children: ReactNode; className?: string }) {
  const onChange = (event: FormEvent<HTMLFormElement>) => {
    const target = event.target as HTMLInputElement;
    if (target.tagName === "SELECT" || target.type === "date") event.currentTarget.requestSubmit();
  };
  return <form method="get" className={className} onChange={onChange}>{children}</form>;
}

/** Opens a native dialog; the content (server- or client-rendered) lives inside. */
export function Modal({ trigger, title, children, size = "md", triggerClassName = "ad-btn", defaultOpen = false }: { trigger: ReactNode; title: string; children: ReactNode; size?: "sm" | "md"; triggerClassName?: string; defaultOpen?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const open = (node: HTMLDialogElement | null) => { ref.current = node; if (node && defaultOpen && !node.open) node.showModal(); };
  return (
    <>
      <button type="button" className={triggerClassName} onClick={() => ref.current?.showModal()}>{trigger}</button>
      <dialog ref={open} className={`ad-dialog${size === "sm" ? " ad-dialog--sm" : ""}`} aria-label={title} onClick={(event) => { if (event.target === event.currentTarget) ref.current?.close(); }}>
        <div className="ad-dialog-body">
          <div className="ad-dialog-head"><h2>{title}</h2><button type="button" className="ad-dialog-close" aria-label="Fermer" onClick={() => ref.current?.close()}>×</button></div>
          {children}
        </div>
      </dialog>
    </>
  );
}

/** A destructive or irreversible action behind a confirmation dialog ("Êtes-vous sûr…"). */
export function ConfirmAction({ action, fields, label, message, confirmLabel = "Confirmer", variant = "danger-outline", small = true, disabled }: { action: AdminAction; fields: Record<string, string>; label: ReactNode; message: ReactNode; confirmLabel?: string; variant?: "danger-outline" | "danger" | "ghost" | "primary" | "outline"; small?: boolean; disabled?: boolean }) {
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDialogElement>(null);
  const cls = variant === "primary" ? "ad-btn" : `ad-btn ad-btn--${variant}`;
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    ref.current?.close();
    // The toast is raised as soon as the server answers: the button itself may disappear with the next render.
    startTransition(async () => {
      const result = await action(initial, data);
      if (result.error) flash(result.error, "err"); else if (result.success) flash(result.success, "ok");
    });
  };
  return (
    <>
      <button type="button" className={`${cls}${small ? " ad-btn--sm" : ""}`} disabled={disabled || pending} onClick={() => ref.current?.showModal()}>{label}</button>
      <dialog ref={ref} className="ad-dialog ad-dialog--sm" aria-label="Confirmation" onClick={(event) => { if (event.target === event.currentTarget) ref.current?.close(); }}>
        <form onSubmit={onSubmit} className="ad-dialog-body">
          {Object.entries(fields).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
          <p className="ad-confirm-text">{message}</p>
          <div className="ad-confirm-actions">
            <button type="button" className="ad-btn ad-btn--ghost" onClick={() => ref.current?.close()}>Annuler</button>
            <button type="submit" className="ad-btn">{confirmLabel}</button>
          </div>
        </form>
      </dialog>
    </>
  );
}

export type PickerOption = { id: string; label: string; icon?: string };

/** Search dropdown ("Ajouter une équipe" / "Ajouter un joueur"): picking an option submits `name=<id>` to the action. */
export function SearchPicker({ action, name, options, placeholder, hidden = {}, createLabel, createName }: { action: AdminAction; name: string; options: PickerOption[]; placeholder: string; hidden?: Record<string, string>; createLabel?: string; createName?: string }) {
  const [state, formAction] = useActionState(action, initial);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const valueRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const matches = options.filter((option) => option.label.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 12);
  const pick = (value: string) => { if (valueRef.current) valueRef.current.value = value; setOpen(false); setQuery(""); formRef.current?.requestSubmit(); };
  return (
    <form ref={formRef} action={formAction} className="ad-menu">
      {Object.entries(hidden).map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)}
      <input ref={valueRef} type="hidden" name={name} />
      {createName && <input type="hidden" name={createName} value={query} />}
      <input className="ad-input ad-input--search" style={{ background: "#fff" }} placeholder={placeholder} value={query} aria-controls={id} role="combobox" aria-expanded={open} aria-autocomplete="list"
        onFocus={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); setOpen(true); }} onBlur={() => setTimeout(() => setOpen(false), 120)} />
      {open && (
        <div className="ad-menu-list" id={id} role="listbox">
          {matches.map((option) => <button type="button" key={option.id} role="option" aria-selected="false" onMouseDown={(event) => event.preventDefault()} onClick={() => pick(option.id)}>{option.icon && /* eslint-disable-next-line @next/next/no-img-element */ <img className="ad-crest" src={option.icon} alt="" />}<span>{option.label}</span><em>+</em></button>)}
          {createLabel && <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => pick("__new__")}><span>{createLabel}{query.trim() ? ` « ${query.trim()} »` : ""}</span><em>+</em></button>}
          {!matches.length && !createLabel && <p className="ad-empty">Aucun résultat</p>}
        </div>
      )}
      <Feedback state={state} />
    </form>
  );
}
