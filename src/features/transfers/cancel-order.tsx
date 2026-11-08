"use client";
import { useActionState } from "react";
import { cancelMercadoTransfer, type TransferActionState } from "./actions";

export function CancelOrder({ id }: { id: string }) {
  const [state, action, pending] = useActionState(cancelMercadoTransfer, {} as TransferActionState);
  return <form action={action}><input type="hidden" name="orderId" value={id}/><button disabled={pending}>{pending ? "Annulation…" : "Annuler cet ordre"}</button>{state.error && <span role="alert">{state.error}</span>}{state.success && <span role="status">{state.success}</span>}</form>;
}
