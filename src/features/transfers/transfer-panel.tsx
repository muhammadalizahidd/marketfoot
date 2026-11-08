"use client";

import { useActionState, useState } from "react";
import { CancelOrder } from "./cancel-order";
import { submitDirectTransfer, submitMercadoTransfer, type TransferActionState } from "./actions";

type Player = { id: string; name: string; position: string; club: string; value: number; owned: boolean };
const initialState: TransferActionState = {};

export function TransferPanel({ players, mode, orders }: { players: Player[]; mode: "open" | "mercado" | null; orders: { id: string; status: string; sold: string; bought: string }[] }) {
  const [state, action, pending] = useActionState(mode === "mercado" ? submitMercadoTransfer : submitDirectTransfer, initialState);
  const [sold, setSold] = useState(""); const [bought, setBought] = useState("");
  const owned = players.filter((player) => player.owned); const available = players.filter((player) => !player.owned);
  const disabled = !mode || !sold || !bought || pending;
  return <section className="transfer-panel"><header><div><p className="eyebrow">{mode === "mercado" ? "Mercado" : "Transfert"}</p><h1>{mode === "mercado" ? "Carnet de transferts" : "Effectuer un transfert"}</h1></div><span className="transfer-status">{mode === "mercado" ? "FENÊTRE OUVERTE" : mode === "open" ? "PÉRIODE OUVERTE" : "INDISPONIBLE"}</span></header>{!mode && <p className="form-error">Aucune période de transfert n’est ouverte.</p>}<form action={action} noValidate className="transfer-form"><label>1. Le joueur que vous vendez<select name="soldPlayerId" value={sold} onChange={(event) => setSold(event.target.value)}><option value="">Choisissez un joueur</option>{owned.map((player) => <option key={player.id} value={player.id}>{player.name} · {player.value.toLocaleString("fr-FR")} €</option>)}</select></label><label>2. Le joueur que vous achetez<select name="boughtPlayerId" value={bought} onChange={(event) => setBought(event.target.value)}><option value="">Choisissez un joueur</option>{available.map((player) => <option key={player.id} value={player.id}>{player.name} · {player.club} · {player.value.toLocaleString("fr-FR")} €</option>)}</select></label>{state.error && <p className="form-error" role="alert">{state.error}</p>}{state.success && <p className="form-success" role="status">{state.success}</p>}<button className="primary-action" disabled={disabled} type="submit">{pending ? "Validation…" : mode === "mercado" ? "Ajouter un ordre Mercado" : "Valider le transfert"}</button></form>{orders.length > 0 && <section className="transfer-history"><h2>Vos ordres Mercado</h2>{orders.map((order) => <div key={order.id}><strong>{order.sold} → {order.bought}</strong><span>{order.status === "pending" ? "En attente" : order.status === "executed" ? "Exécuté" : order.status === "cancelled" ? "Annulé" : "Refusé"}</span>{order.status === "pending" && mode === "mercado" && <CancelOrder id={order.id}/>}</div>)}</section>}</section>;
}
