"use client";

import { useActionState, useMemo, useState } from "react";
import { Bench, DisplayModeSwitch, Pitch, PlayerCard, type DisplayMode, type PitchPlayer } from "@/components/team/pitch";
import { TeamTabs } from "@/components/team/team-tabs";
import { submitDirectTransfer, submitMercadoTransfer, cancelMercadoTransfer, type TransferActionState } from "./actions";
import { getJerseyImage } from "@/lib/jersey-map";
import { getTransferTaxRate, type TransferMode } from "@/rules/transfers";
import { marketfootRulesConfig } from "@/rules/config";

// ponytail: lightweight club code mapper for catalogue badges
export function getClubAbbreviation(clubName?: string): string {
  if (!clubName) return "L1";
  const name = clubName.toLowerCase();
  if (name.includes("marseille") || name.includes("om")) return "OM";
  if (name.includes("monaco") || name.includes("asm")) return "ASM";
  if (name.includes("brest") || name.includes("sb")) return "SB";
  if (name.includes("toulouse") || name.includes("tfc")) return "TFC";
  if (name.includes("lille") || name.includes("losc")) return "LIL";
  if (name.includes("paris saint") || name.includes("psg")) return "PSG";
  if (name.includes("lens") || name.includes("rcl")) return "RCL";
  if (name.includes("rennes") || name.includes("rennais") || name.includes("srfc")) return "SR";
  if (name.includes("lyon") || name.includes("ol")) return "OL";
  if (name.includes("strasbourg") || name.includes("rcsa")) return "RCS";
  if (name.includes("nantes") || name.includes("fcn")) return "FCN";
  if (name.includes("nice") || name.includes("ogc")) return "OGC";
  if (name.includes("angers") || name.includes("sco")) return "SCO";
  if (name.includes("havre") || name.includes("hac")) return "HAC";
  if (name.includes("auxerre") || name.includes("aja")) return "AJA";
  if (name.includes("saint-étienne") || name.includes("asse")) return "ASSE";
  if (name.includes("reims") || name.includes("sdr")) return "SDR";
  if (name.includes("montpellier") || name.includes("mhsc")) return "MHSC";
  if (name.includes("troyes") || name.includes("estac")) return "ESTAC";
  if (name.includes("lorient")) return "FCL";
  if (name.includes("mans")) return "MANS";
  if (name.includes("paris fc") || name.includes("pfc")) return "PFC";
  return clubName.slice(0, 3).toUpperCase();
}

// ponytail: compact french euro format matching Figma (e.g. 18,60 M€, 645 k€)
export function formatCompactEuro(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) {
    const val = amount / 1_000_000;
    return `${val.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} M€`;
  }
  if (abs >= 1_000) {
    const val = amount / 1_000;
    return `${Math.round(val).toLocaleString("fr-FR")} k€`;
  }
  return `${amount.toLocaleString("fr-FR")} €`;
}

export type TransferMember = {
  id: string;
  name: string;
  position: string;
  value: number;
  isStarter: boolean;
  isCaptain: boolean;
  frozen?: boolean;
  clubName?: string;
  clubId?: string;
  acquiredValue?: number;
  owners?: number;
};

export type CataloguePlayer = {
  id: string;
  name: string;
  position: string;
  club: string;
  clubId?: string;
  value: number;
  owned: boolean;
};

export type MercadoOrderView = {
  id: string;
  status: string;
  sold: string;
  bought: string;
};

const formation: Record<string, number> = { FW: 3, MF: 3, DF: 4, GK: 1 };
const positionOrder = ["FW", "MF", "DF", "GK"];

export function TransferManager({
  members = [],
  catalogue = [],
  mode,
  matchdayNumber = 1,
  matchdayId = null,
  currentBudget = 0,
  transfersAlreadyMade = 0,
  orders = [],
  taxRates,
}: {
  members: TransferMember[];
  catalogue: CataloguePlayer[];
  mode: TransferMode | null;
  matchdayNumber?: number;
  matchdayId?: string | null;
  currentBudget: number;
  transfersAlreadyMade?: number;
  orders?: MercadoOrderView[];
  /** Rates resolved on the server from the active Barèmes. */
  taxRates?: { direct: number; mercado: number };
}) {
  const [soldPlayerId, setSoldPlayerId] = useState<string>("");
  const [boughtPlayerId, setBoughtPlayerId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [positionFilter, setPositionFilter] = useState<string>("ALL");
  const [inBudgetOnly, setInBudgetOnly] = useState(false);
  const [selectedPlayerForModal, setSelectedPlayerForModal] = useState<CataloguePlayer | null>(null);
  const [displayMode, setDisplayMode] = useState<DisplayMode>("value");

  // Server actions
  const transferAction = mode === "mercado" ? submitMercadoTransfer : submitDirectTransfer;
  const [state, action, pending] = useActionState(transferAction, {} as TransferActionState);
  const [cancelState, cancelAction, cancelPending] = useActionState(cancelMercadoTransfer, {} as TransferActionState);

  const soldPlayer = members.find((m) => m.id === soldPlayerId);
  const boughtPlayer = catalogue.find((p) => p.id === boughtPlayerId);
  const requiredPosition = soldPlayer?.position ?? null;

  // Tax calculation per rules
  const taxRate = useMemo(() => {
    try {
      if (taxRates) return mode === "mercado" ? taxRates.mercado : taxRates.direct;
      return getTransferTaxRate(matchdayNumber, mode === "mercado" ? "mercado" : "direct");
    } catch {
      return 0.07;
    }
  }, [matchdayNumber, mode, taxRates]);

  const taxPercentDisplay = Math.round(taxRate * 100);
  const soldValue = soldPlayer ? soldPlayer.value : 0;
  const boughtValue = boughtPlayer ? boughtPlayer.value : 0;
  const taxAmount = boughtPlayer ? Math.round(boughtValue * taxRate) : 0;
  const netTransferTotal = soldValue - boughtValue - taxAmount;
  const budgetAfterTransfer = currentBudget + netTransferTotal;

  // Club limits validation (max 4 per club)
  const clubCountAfter = useMemo(() => {
    if (!boughtPlayer?.clubId) return 0;
    const remainingClubCount = members
      .filter((m) => m.id !== soldPlayerId && m.clubId === boughtPlayer.clubId)
      .length;
    return remainingClubCount + 1;
  }, [members, soldPlayerId, boughtPlayer]);

  const isClubLimitExceeded = clubCountAfter > marketfootRulesConfig.squad.maxPlayersPerClub;
  const isBudgetSufficient = budgetAfterTransfer >= 0 || (currentBudget < 0 && budgetAfterTransfer > currentBudget);
  const quotaLimit = marketfootRulesConfig.transfers.quotaPerMatchday; // 4
  const isQuotaReached = transfersAlreadyMade >= quotaLimit;

  const canSubmit = Boolean(
    mode &&
    soldPlayerId &&
    boughtPlayerId &&
    soldPlayerId !== boughtPlayerId &&
    !isQuotaReached &&
    !isClubLimitExceeded &&
    (!requiredPosition || boughtPlayer?.position === requiredPosition) &&
    isBudgetSufficient &&
    !pending
  );

  // Filtered catalogue
  const filteredCatalogue = useMemo(() => {
    let list = catalogue.filter((p) => !p.owned);
    const activePosition = requiredPosition ?? positionFilter;
    if (activePosition !== "ALL") {
      list = list.filter((p) => p.position === activePosition);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.club.toLowerCase().includes(q));
    }
    if (inBudgetOnly) {
      const availableMax = currentBudget + soldValue;
      list = list.filter((p) => p.value * (1 + taxRate) <= availableMax);
    }
    return list;
  }, [catalogue, positionFilter, requiredPosition, searchQuery, inBudgetOnly, currentBudget, soldValue, taxRate]);

  // Click on pitch / bench slot sets sold player
  const handleSlotClick = (member?: TransferMember) => {
    if (!member) return;
    if (member.frozen) return;
    if (soldPlayerId === member.id) {
      setSoldPlayerId("");
    } else {
      setSoldPlayerId(member.id);
      setPositionFilter(member.position);
      setBoughtPlayerId((current) => catalogue.find((player) => player.id === current)?.position === member.position ? current : "");
    }
  };

  const [starters] = useState(() =>
    new Set(
      members.some((m) => m.isStarter)
        ? members.filter((m) => m.isStarter).map((m) => m.id)
        : Object.entries(formation).flatMap(([position, count]) =>
            members.filter((m) => m.position === position).slice(0, count).map((m) => m.id)
          )
    )
  );

  const renderSlot = (member: TransferMember | undefined, position: string, key: string) => {
    if (!member) return <PlayerCard key={key} position={position} mode={displayMode} disabled />;
    const isSelected = soldPlayerId === member.id;
    const replacement = isSelected ? boughtPlayer : undefined;
    const acquired = member.acquiredValue ?? member.value;
    const shown: PitchPlayer = replacement
      ? { id: member.id, name: replacement.name, clubName: replacement.club, value: replacement.value, changePct: 0, speculation: 0, isCaptain: member.isCaptain, frozen: member.frozen }
      : {
          id: member.id,
          name: member.name,
          clubName: member.clubName,
          value: member.value,
          changePct: acquired > 0 ? ((member.value - acquired) / acquired) * 100 : 0,
          speculation: member.value - acquired,
          owners: member.owners,
          isCaptain: member.isCaptain,
          frozen: member.frozen,
        };
    return <PlayerCard key={key} player={shown} position={position} mode={displayMode} state={{ selected: isSelected }} disabled={member.frozen} onSelect={() => handleSlotClick(member)} />;
  };

  const pitchRows = positionOrder.map((position) => {
    const posMembers = members.filter((m) => m.position === position && starters.has(m.id));
    return Array.from({ length: formation[position] }).map((_, i) => renderSlot(posMembers[i], position, `${position}-${i}`));
  });
  const benchRows = positionOrder.map((position) => {
    const posMembers = members.filter((m) => m.position === position && !starters.has(m.id));
    return Array.from({ length: 2 }).map((_, i) => renderSlot(posMembers[i], position, `b-${position}-${i}`));
  });

  return (
    <div className="tm-workspace">
      <div className="tm-main">
        <TeamTabs active="transfert" />
        <DisplayModeSwitch mode={displayMode} onChange={setDisplayMode} />
        <div className="tm-field">
          <Pitch rows={pitchRows} />
          <Bench rows={benchRows} />
        </div>

        <p className="tm-note">
          {mode === "mercado"
            ? "La période de mercato est ouverte. Ajoute tes ordres de transfert avant sa fermeture."
            : "Pour réaliser un transfert, choisis le joueur de ton équipe que tu veux remplacer et sélectionne le joueur de ton choix dans la liste"}
        </p>
        {!mode && <div className="tm-alert tm-alert--info">Aucune période de transfert n’est actuellement ouverte.</div>}
        {state.error && <div className="tm-alert tm-alert--error">{state.error}</div>}
        {state.success && <div className="tm-alert tm-alert--success">{state.success}</div>}
        {cancelState.error && <div className="tm-alert tm-alert--error">{cancelState.error}</div>}
        {cancelState.success && <div className="tm-alert tm-alert--success">{cancelState.success}</div>}
      </div>

      <div className="tm-aside">
      <aside className="tm-panel tm-panel--form" aria-label="Transferts">
        <header className="tm-panel-head">
          <h2>Transferts</h2>
          <span className="tm-badge">{transfersAlreadyMade}/{quotaLimit}</span>
        </header>
        <div className="tm-panel-quota" aria-hidden="true">
          {Array.from({ length: quotaLimit }).map((_, i) => (
            <div key={i} className={`transfer-segment ${i < transfersAlreadyMade ? "is-active" : ""}`} />
          ))}
        </div>

        {/* Scrollable Form Body */}
        <div className="transfer-drawer-body">
          {/* Card 1: Le joueur que tu vends */}
          <div className="transfer-step-card">
            <div className="step-card-header">
              <span className="step-circle">1</span>
              <span className="step-title">Le joueur que tu vends</span>
            </div>
            {soldPlayer ? (
              <div className="transfer-dashed-slot has-player">
                <div className="dashed-slot-left">
                  <img
                    src={getJerseyImage(soldPlayer.clubName)}
                    alt=""
                    className="transfer-slot-jersey"
                  />
                  <span className="transfer-slot-name">{soldPlayer.name}</span>
                </div>
                <div className="dashed-slot-right">
                  <span className="transfer-slot-price">{formatCompactEuro(soldPlayer.value)}</span>
                  <button
                    type="button"
                    className="transfer-slot-clear"
                    onClick={() => setSoldPlayerId("")}
                    title="Désélectionner"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ) : (
              <div className="transfer-dashed-slot is-empty">
                <span>Choisis ton joueur à vendre sur le terrain</span>
              </div>
            )}
          </div>

          {/* Card 2: Le joueur que tu achètes */}
          <div className="transfer-step-card">
            <div className="step-card-header">
              <span className="step-circle">2</span>
              <span className="step-title">Le joueur que tu achètes</span>
            </div>

            {/* Selected bought player preview */}
            {boughtPlayer ? (
              <div className="transfer-dashed-slot has-player">
                <div className="dashed-slot-left">
                  <img
                    src={getJerseyImage(boughtPlayer.club)}
                    alt=""
                    className="transfer-slot-jersey"
                  />
                  <span className="transfer-slot-name">{boughtPlayer.name}</span>
                </div>
                <div className="dashed-slot-right">
                  <span className="transfer-slot-price">{formatCompactEuro(boughtPlayer.value)}</span>
                  <button
                    type="button"
                    className="transfer-slot-clear"
                    onClick={() => setBoughtPlayerId("")}
                    title="Désélectionner"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ) : (
              <div className="transfer-dashed-slot is-empty">
                <span>Choisis ton joueur à acheter</span>
              </div>
            )}

            {/* Search input */}
            <div className="transfer-search-box">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="text"
                placeholder="Rechercher un joueur..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Filter pills: Poste, Prix, Club */}
            <div className="transfer-filters-row">
              <button
                type="button"
                className="filter-pill-btn"
                disabled={Boolean(requiredPosition)}
                onClick={() =>
                  setPositionFilter((p) => (p === "ALL" ? "FW" : p === "FW" ? "MF" : p === "MF" ? "DF" : p === "DF" ? "GK" : "ALL"))
                }
              >
                Poste {requiredPosition ? `(${requiredPosition})` : positionFilter !== "ALL" ? `(${positionFilter})` : ""} <span>⌄</span>
              </button>
              <button
                type="button"
                className="filter-pill-btn"
                onClick={() => setInBudgetOnly((prev) => !prev)}
              >
                Prix <span>⌄</span>
              </button>
              <button type="button" className="filter-pill-btn" onClick={() => setSearchQuery("")}>
                Club <span>⌄</span>
              </button>
            </div>

            {/* Checkbox: Dans mon budget */}
            <div className="budget-checkbox-row">
              <label className={`budget-toggle-pill ${inBudgetOnly ? "is-active" : ""}`}>
                <input
                  type="checkbox"
                  checked={inBudgetOnly}
                  onChange={(e) => setInBudgetOnly(e.target.checked)}
                />
                <span className="budget-check-icon">✓</span>
                <span>Dans mon budget</span>
              </label>
            </div>

            {/* Catalogue list */}
            <div className="transfer-catalogue-list">
              {filteredCatalogue.slice(0, 40).map((player) => {
                const isSelected = player.id === boughtPlayerId;
                return (
                  <div
                    key={player.id}
                    className={`catalogue-player-row ${isSelected ? "is-selected" : ""}`}
                    onClick={() => setBoughtPlayerId(player.id)}
                  >
                    <img src={getJerseyImage(player.club)} alt="" className="catalogue-row-jersey" />
                    <span className="catalogue-club-badge">{getClubAbbreviation(player.club)}</span>
                    <span className="catalogue-player-name">{player.name}</span>
                    <span className="catalogue-player-price">{formatCompactEuro(player.value)}</span>
                    <button
                      type="button"
                      className="catalogue-eye-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPlayerForModal(player);
                      }}
                      title="Détails du joueur"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>
                  </div>
                );
              })}
              {filteredCatalogue.length === 0 && (
                <div className="catalogue-empty">Aucun joueur correspondant trouvé.</div>
              )}
            </div>
          </div>

          {/* Card 3: Coût du transfert */}
          <div className="transfer-step-card">
            <div className="step-card-header">
              <span className="step-circle">3</span>
              <span className="step-title">Coût du transfert</span>
            </div>

            <div className="cost-breakdown-table">
              <div className="cost-row">
                <span className="cost-label">Prix de vente :</span>
                <span className={`cost-val ${soldPlayer ? "val-positive" : "val-muted"}`}>
                  {soldPlayer ? `+ ${formatCompactEuro(soldValue)}` : "—"}
                </span>
              </div>
              <div className="cost-row">
                <span className="cost-label">Prix d’achat :</span>
                <span className={`cost-val ${boughtPlayer ? "val-negative" : "val-muted"}`}>
                  {boughtPlayer ? `- ${formatCompactEuro(boughtValue)}` : "—"}
                </span>
              </div>
              <div className="cost-row">
                <span className="cost-label">Taxe ({taxPercentDisplay}%) :</span>
                <span className={`cost-val ${boughtPlayer ? "val-negative" : "val-muted"}`}>
                  {boughtPlayer ? `- ${formatCompactEuro(taxAmount)}` : "—"}
                </span>
              </div>
              <hr className="cost-divider" />
              <div className="cost-row cost-total-row">
                <span className="cost-label">Total :</span>
                <span
                  className={`cost-val ${
                    netTransferTotal > 0
                      ? "val-positive"
                      : netTransferTotal < 0
                      ? "val-negative"
                      : "val-muted"
                  }`}
                >
                  {soldPlayer || boughtPlayer
                    ? `${netTransferTotal >= 0 ? "+ " : ""}${formatCompactEuro(netTransferTotal)}`
                    : "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Mercado Orders History (if applicable) */}
          {orders.length > 0 && (
            <div className="transfer-step-card">
              <div className="step-card-header">
                <span className="step-circle">📋</span>
                <span className="step-title">Ordres Mercado en attente ({orders.length})</span>
              </div>
              <div className="orders-list-mini">
                {orders.map((o) => (
                  <div key={o.id} className="order-row-mini">
                    <span className="order-text">
                      <b>{o.sold}</b> → <b>{o.bought}</b>
                    </span>
                    {o.status === "pending" && (
                      <form action={cancelAction}>
                        <input type="hidden" name="orderId" value={o.id} />
                        <button
                          type="submit"
                          disabled={cancelPending}
                          className="cancel-order-btn"
                          title="Annuler l'ordre"
                        >
                          Annuler
                        </button>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer: Mint Budget Card + Valider Button */}
        <div className="transfer-drawer-footer">
          <div className="transfer-budget-mint-card">
            <span className="mint-card-label">Budget après transfert :</span>
            <span
              className={`mint-card-value ${budgetAfterTransfer >= 0 ? "val-positive" : "val-negative"}`}
            >
              {budgetAfterTransfer >= 0 ? "+ " : ""}
              {formatCompactEuro(budgetAfterTransfer)}
            </span>
          </div>

          <form action={action} className="transfer-form-submit">
            <input type="hidden" name="soldPlayerId" value={soldPlayerId} />
            <input type="hidden" name="boughtPlayerId" value={boughtPlayerId} />
            <button
              type="submit"
              disabled={!canSubmit}
              className={`transfer-valider-btn ${canSubmit ? "is-enabled" : ""}`}
            >
              {pending
                ? "Validation..."
                : isQuotaReached
                ? "Quota atteint (4/4)"
                : isClubLimitExceeded
                ? "Max 4 joueurs par club"
                : !isBudgetSufficient
                ? "Budget insuffisant"
                : mode === "mercado"
                ? "Ajouter un ordre Mercado"
                : "Valider"}
            </button>
          </form>
        </div>
      </aside>
      </div>

      {/* Quick Player Modal (when clicking eye icon) */}
      {selectedPlayerForModal && (
        <div className="player-modal-backdrop" onClick={() => setSelectedPlayerForModal(null)}>
          <div className="player-modal-card" onClick={(e) => e.stopPropagation()}>
            <header className="player-modal-header">
              <img
                src={getJerseyImage(selectedPlayerForModal.club)}
                alt=""
                className="player-modal-jersey"
              />
              <div>
                <h3>{selectedPlayerForModal.name}</h3>
                <p>
                  {selectedPlayerForModal.club} · {selectedPlayerForModal.position}
                </p>
              </div>
              <button
                type="button"
                className="player-modal-close"
                onClick={() => setSelectedPlayerForModal(null)}
              >
                ✕
              </button>
            </header>
            <div className="player-modal-body">
              <div className="modal-stat-pill">
                <span>Valeur MarketFoot :</span>
                <b>{formatCompactEuro(selectedPlayerForModal.value)}</b>
              </div>
              <button
                type="button"
                className="transfer-valider-btn is-enabled mt-3"
                onClick={() => {
                  if (!requiredPosition || selectedPlayerForModal.position === requiredPosition) setBoughtPlayerId(selectedPlayerForModal.id);
                  setSelectedPlayerForModal(null);
                }}
              >
                Sélectionner pour le transfert
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
