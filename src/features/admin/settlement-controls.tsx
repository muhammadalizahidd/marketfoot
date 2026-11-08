"use client";

import { ActionForm, ConfirmAction, Modal } from "@/components/admin/client";
import { executeSettlementAction, rollbackSettlementAction } from "./actions";

/** Execute (with confirmation) a pending settlement, or cancel a completed one with a mandatory reason. */
export function SettlementControls({ settlementId, status }: { settlementId: string; status: string }) {
  if (status === "pending") {
    return <ConfirmAction action={executeSettlementAction} fields={{ settlementId, confirmation: "execute" }} small={false} variant="primary" label="Comptabiliser le règlement"
      message="Cette action crédite les comptes et clôture la journée. Le journal garantit qu’elle ne peut être appliquée qu’une fois." confirmLabel="Comptabiliser" />;
  }
  if (status === "completed") {
    return (
      <Modal size="sm" triggerClassName="ad-btn ad-btn--danger-outline ad-btn--sm" trigger="Annuler et recalculer" title="Annuler le règlement">
        <ActionForm action={rollbackSettlementAction} submitLabel="Annuler le règlement" toast>
          <input type="hidden" name="settlementId" value={settlementId} />
          <label className="ad-field"><span>Motif de correction</span><textarea className="ad-textarea" name="reason" minLength={8} maxLength={500} required placeholder="Ex. résultat officiel corrigé après vérification." style={{ padding: 12, minHeight: 90 }} /></label>
        </ActionForm>
      </Modal>
    );
  }
  return null;
}
