"use client";

import { useSyncExternalStore } from "react";

type Flash = { id: number; text: string; tone: "ok" | "err" } | null;
let current: Flash = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

/** Shows a toast. It lives outside the page tree, so it survives the re-render that removes the button which triggered it. */
export function flash(text: string, tone: "ok" | "err" = "ok") {
  const id = Date.now() + Math.random();
  current = { id, text, tone };
  emit();
  setTimeout(() => { if (current?.id === id) { current = null; emit(); } }, tone === "err" ? 9000 : 6000);
}

export function FlashHost() {
  const message = useSyncExternalStore((listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => current, () => null);
  if (!message) return null;
  return <div className={`ad-flash ad-flash--${message.tone}`} role={message.tone === "err" ? "alert" : "status"}>{message.text}<button type="button" aria-label="Fermer" onClick={() => { current = null; emit(); }}>×</button></div>;
}
