import type { ReactNode } from "react";

import { ActionForm, ConfirmAction } from "@/components/admin/client";
import { Card, NumberField, PageHeader, PillTabs } from "@/components/admin/ui";
import { bonusCatalogue } from "@/lib/bonus-catalogue";
import { formatDateTime } from "@/lib/admin/format";
import { restoreBaremes, saveBaremes } from "@/features/admin/baremes-actions";
import { ensureRulesSettings, listRulesVersions } from "@/services/rules-settings";
import { honoursBandKeys, honoursCategories, positionKeys, type RulesSettings } from "@/rules/settings";
import { marketfootRulesConfig } from "@/rules/config";

const tabs = [
  { id: "general", label: "Général", href: "/admin/baremes?tab=general" },
  { id: "primes", label: "Primes", href: "/admin/baremes?tab=primes" },
  { id: "palmares", label: "Palmarès", href: "/admin/baremes?tab=palmares" },
];
const positionLabels: Record<string, string> = { GK: "Gardien", DF: "Défenseur", MF: "Milieu", FW: "Attaquant" };
const bandLabels: Record<string, string> = { "1": "1er", "2": "2e", "3": "3e", "10": "4e – 10e", "20": "11e – 20e", "30": "21e – 30e", "50": "31e – 50e", "100": "51e – 100e" };
const categoryLabels: Record<string, string> = { overall: "Général", first_half: "Phase aller", primes: "Primes", predictions: "Pronos", matchday_primes: "Journée primes", matchday_predictions: "Journée pronos" };
const euro = (value: number) => Math.round(value * 100) / 100;
const pct = (ratio: number) => Math.round(ratio * 10000) / 100;

function Hidden({ tab }: { tab: string }) { return <input type="hidden" name="tab" value={tab} />; }

function GeneralTab({ s }: { s: RulesSettings }) {
  return (
    <ActionForm action={saveBaremes} className="ad-stack" submitLabel="Enregistrer les barèmes">
      <Hidden tab="general" />
      <div className="ad-grid-3">
        <Card title="Budget">
          <div className="ad-form">
            <NumberField name="budget.coefficientInitial" label="Coefficient initial (COEFF_INI)" defaultValue={s.budget.coefficientInitial} hint="Budget initial = valeur moyenne × 19 × COEFF_INI + journées jouées × COEFF_STEP (PRD §5.1, formule provisoire)" />
            <NumberField name="budget.coefficientMatchday" label="Coefficient par journée (COEFF_STEP)" defaultValue={s.budget.coefficientMatchday} />
            <NumberField name="budget.positiveShareToBudgetPct" label="Part des primes au budget" suffix="%" defaultValue={s.budget.positiveShareToBudgetPct} step="1" />
            <p className="ad-muted">Part du compte bloqué : <b>{100 - s.budget.positiveShareToBudgetPct} %</b> (le reste des primes positives).</p>
          </div>
        </Card>
        <Card title="Transferts">
          <div className="ad-form">
            <NumberField name="quota" label="Nombre de transferts entre 2 journées" defaultValue={marketfootRulesConfig.transfers.quotaPerMatchday} disabled hint="Règle structurelle appliquée par la base de données (PRD §23)" />
            <NumberField name="clubLimit" label="Joueurs d’un même club" defaultValue={marketfootRulesConfig.squad.maxPlayersPerClub} disabled hint="Règle structurelle appliquée par la base de données (PRD §23)" />
            <NumberField name="freeze" label="Gel avant le coup d’envoi (heures)" defaultValue={s.freeze.hoursBeforeKickoff} disabled hint="Appliqué par la base de données (PRD §7.2)" />
            <NumberField name="transfers.fixedMercadoCommission" label="Commission fixe par ordre Mercato (€)" defaultValue={euro(s.transfers.fixedMercadoCommission)} step="1000" />
          </div>
        </Card>
        <Card title="Impacts">
          <div className="ad-form">
            <NumberField name="transfers.impactBuy" label="Impact achat (€)" defaultValue={euro(s.transfers.impactBuy)} step="1000" />
            <NumberField name="transfers.impactSale" label="Impact vente (€)" defaultValue={euro(s.transfers.impactSale)} step="1000" />
            <NumberField name="transfers.mercadoSharePct" label="Part appliquée au mercato" suffix="%" defaultValue={s.transfers.mercadoSharePct} step="1" />
          </div>
        </Card>
      </div>

      <Card title="Taxe de transfert (PRD §8.4, selon la période et la journée)">
        <div className="ad-table-scroll">
          <table className="ad-table">
            <thead><tr><th>Contexte</th>{[0, 1, 2].map((i) => <th key={i}>Tranche {i + 1} — jusqu’à la journée / taux</th>)}</tr></thead>
            <tbody>
              {(["direct", "mercado"] as const).map((mode) => (
                <tr key={mode}>
                  <td>{mode === "direct" ? "Transfert libre (hors fenêtre)" : "Transfert Mercato"}</td>
                  {s.transfers.tax[mode].map((step, i) => (
                    <td key={i}><div className="ad-pair">
                      <NumberField name={`transfers.tax.${mode}.${i}.throughMatchday`} label="Journée" defaultValue={step.throughMatchday} step="1" />
                      <NumberField name={`pct:transfers.tax.${mode}.${i}.rate`} label="Taux %" defaultValue={pct(step.rate)} step="0.01" />
                    </div></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="ad-grid-3">
        <Card title="Capitaine">
          <div className="ad-form">
            <NumberField name="captain.multiplier" label="Multiplicateur" defaultValue={s.captain.multiplier} step="0.5" />
            <NumberField name="captainMax" label="Maximum par joueur" defaultValue={marketfootRulesConfig.captain.maxUsesPerChampionship} disabled hint="Règle structurelle (PRD §6.3)" />
          </div>
        </Card>
        <Card title="Pronostics — G = ((a·x³) + (b·x) + c) · d">
          <div className="ad-form">
            <div className="ad-pair">
              <NumberField name="predictions.cubic" label="a (x³)" defaultValue={s.predictions.cubic} />
              <NumberField name="predictions.linear" label="b (x)" defaultValue={s.predictions.linear} />
            </div>
            <div className="ad-pair">
              <NumberField name="predictions.base" label="c (base)" defaultValue={s.predictions.base} />
              <NumberField name="predictions.scale" label="d (échelle)" defaultValue={s.predictions.scale} />
            </div>
            <div className="ad-pair">
              <NumberField name="predictions.min" label="Plancher (€)" defaultValue={s.predictions.min} step="1000" />
              <NumberField name="predictions.max" label="Plafond (€)" defaultValue={s.predictions.max} step="1000" />
            </div>
            <label className="ad-field--check"><input type="hidden" name="bool:predictions.negativePayoutDeducted" value="false" /><input type="checkbox" name="bool:predictions.negativePayoutDeducted" value="true" defaultChecked={s.predictions.negativePayoutDeducted} /> Déduire un gain négatif (PRD §24.9)</label>
          </div>
        </Card>
        <Card title="Bonus">
          <div className="ad-form">
            <NumberField name="bonus.gainPct" label="Gain d’un bonus réussi (par rapport aux primes des titulaires)" suffix="%" defaultValue={s.bonus.gainPct} step="1" />
          </div>
        </Card>
      </div>

      <Card title="Liste des bonus (PRD §6.4)" flush>
        <div className="ad-table-scroll">
          <table className="ad-table">
            <thead><tr><th>Statut</th><th>Nom</th><th>Condition</th><th>Max / saison</th></tr></thead>
            <tbody>
              {bonusCatalogue.map((bonus) => {
                const index = s.bonus.list.findIndex((item) => item.id === bonus.id);
                const row = s.bonus.list[index];
                return (
                  <tr key={bonus.id}>
                    <td><input type="hidden" name={`bool:bonus.list.${index}.enabled`} value="false" /><input type="checkbox" name={`bool:bonus.list.${index}.enabled`} value="true" defaultChecked={row.enabled} aria-label={`Activer ${bonus.title}`} /></td>
                    <td><b>{bonus.title}</b></td>
                    <td>{bonus.text}</td>
                    <td style={{ width: 160 }}><NumberField name={`bonus.list.${index}.maxPerSeason`} defaultValue={row.maxPerSeason} step="1" hideLabel label={`Maximum ${bonus.title}`} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </ActionForm>
  );
}

function PositionRows({ title, path, s }: { title: string; path: "goal" | "assist" | "cleanSheet" | "yellow" | "red" | "base"; s: RulesSettings }) {
  const data = s.primes[path];
  return (
    <tr>
      <td>{title}</td>
      {positionKeys.map((pos) => (
        <td key={pos}><div className="ad-pair">
          <NumberField name={`primes.${path}.starter.${pos}`} defaultValue={euro(data.starter[pos])} step="1000" hideLabel label={`${title} titulaire ${positionLabels[pos]}`} />
          <NumberField name={`primes.${path}.substitute.${pos}`} defaultValue={euro(data.substitute[pos])} step="1000" hideLabel label={`${title} remplaçant ${positionLabels[pos]}`} />
        </div></td>
      ))}
    </tr>
  );
}
function SingleRow({ title, path, s }: { title: string; path: "penaltyScored" | "ownGoal" | "substituted" | "missedPenalty"; s: RulesSettings }) {
  return (
    <tr>
      <td>{title}</td>
      <td colSpan={4}><div className="ad-pair" style={{ maxWidth: 420 }}>
        <NumberField name={`primes.${path}.starter`} defaultValue={euro(s.primes[path].starter)} step="1000" hideLabel label={`${title} titulaire`} />
        <NumberField name={`primes.${path}.substitute`} defaultValue={euro(s.primes[path].substitute)} step="1000" hideLabel label={`${title} remplaçant`} />
      </div></td>
    </tr>
  );
}
function FlatRow({ title, name, value }: { title: string; name: string; value: number }) {
  return <tr><td>{title}</td><td colSpan={4} style={{ maxWidth: 220 }}><div style={{ maxWidth: 200 }}><NumberField name={name} defaultValue={euro(value)} step="1000" hideLabel label={title} /></div></td></tr>;
}

function PrimesTab({ s }: { s: RulesSettings }) {
  const head = <thead><tr><th>Événement</th>{positionKeys.map((pos) => <th key={pos}>{positionLabels[pos]} <small>(titulaire / remplaçant)</small></th>)}</tr></thead>;
  return (
    <ActionForm action={saveBaremes} className="ad-stack" submitLabel="Enregistrer les barèmes">
      <Hidden tab="primes" />
      <p className="ad-note ad-note--info">Montants en euros : chaque cellule contient la valeur <b>titulaire</b> puis la valeur <b>remplaçant</b> (PRD §11.1). Les montants restent provisoires tant que le client ne les a pas confirmés (PRD §24.28). La pondération par tranche de minutes n’existe pas dans les règles confirmées (PRD §11.7) et n’est donc pas proposée.</p>
      <Card title="Résultat d’équipe (PRD §11.4)">
        <div className="ad-grid-3" style={{ gridTemplateColumns: "repeat(6, minmax(0, 1fr))" }}>
          {([["away_win", "Victoire à l’extérieur"], ["home_win", "Victoire à domicile"], ["away_draw", "Nul à l’extérieur"], ["home_draw", "Nul à domicile"], ["away_loss", "Défaite à l’extérieur"], ["home_loss", "Défaite à domicile"]] as const).map(([key, label]) => (
            <NumberField key={key} name={`teamResult.${key}`} label={label} defaultValue={euro(s.teamResult[key])} step="1000" />
          ))}
        </div>
      </Card>
      <div className="ad-stack">
        <Card title="Primes positives (PRD §11.2)" flush>
          <div className="ad-table-scroll"><table className="ad-table">{head}<tbody>
            <PositionRows title="Titulaire / Remplaçant" path="base" s={s} />
            <PositionRows title="But" path="goal" s={s} />
            <SingleRow title="Pénalty réussi" path="penaltyScored" s={s} />
            <PositionRows title="Passe décisive" path="assist" s={s} />
            <PositionRows title="Clean sheet" path="cleanSheet" s={s} />
            <FlatRow title="Arrêt du gardien" name="primes.save" value={s.primes.save} />
          </tbody></table></div>
        </Card>
        <Card title="Primes négatives (PRD §11.3)" flush>
          <div className="ad-table-scroll"><table className="ad-table">{head}<tbody>
            <PositionRows title="Carton jaune" path="yellow" s={s} />
            <PositionRows title="Carton rouge" path="red" s={s} />
            <SingleRow title="Pénalty raté" path="missedPenalty" s={s} />
            <SingleRow title="But contre son camp" path="ownGoal" s={s} />
            <SingleRow title="Remplacé en cours de match" path="substituted" s={s} />
            <FlatRow title="Match non joué" name="primes.notPlayed" value={s.primes.notPlayed} />
            <FlatRow title="Buts encaissés — à partir du 2e" name="primes.concededSecond" value={s.primes.concededSecond} />
            <FlatRow title="Buts encaissés — par but supplémentaire" name="primes.concededExtra" value={s.primes.concededExtra} />
          </tbody></table></div>
        </Card>
      </div>
      <p className="ad-muted">« Triplé » et « 8 arrêts et plus » (astérisques du PRD §24.7) ne sont pas appliqués tant que leur sens n’est pas confirmé.</p>
    </ActionForm>
  );
}

function PalmaresTab({ s }: { s: RulesSettings }) {
  return (
    <ActionForm action={saveBaremes} className="ad-stack" submitLabel="Enregistrer les barèmes">
      <Hidden tab="palmares" />
      <Card title="Points palmarès (PRD §16.1)" flush>
        <div className="ad-table-scroll">
          <table className="ad-table">
            <thead><tr><th>Rang</th>{honoursCategories.map((category) => <th key={category}>{categoryLabels[category]}</th>)}</tr></thead>
            <tbody>
              {honoursBandKeys.map((band) => (
                <tr key={band}>
                  <td>{bandLabels[band]}</td>
                  {honoursCategories.map((category) => <td key={category} style={{ minWidth: 120 }}><NumberField name={`honours.${category}.${band}`} defaultValue={s.honours[category]?.[band] ?? 0} step="1" hideLabel label={`${categoryLabels[category]} ${bandLabels[band]}`} /></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </ActionForm>
  );
}

export default async function BaremesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const requested = (await searchParams).tab;
  const tab = tabs.some((item) => item.id === requested) ? requested! : "general";
  const [{ settings, version }, versions] = await Promise.all([ensureRulesSettings(), listRulesVersions(6)]);
  return (
    <main>
      <PageHeader title="Barèmes" actions={<span className="ad-chip ad-chip--info">{version ? `Version ${version}` : "Valeurs de référence du PRD"}</span>} />
      <PillTabs tabs={tabs} active={tab} />
      {tab === "general" && <GeneralTab s={settings} />}
      {tab === "primes" && <PrimesTab s={settings} />}
      {tab === "palmares" && <PalmaresTab s={settings} />}
      {versions.length > 0 && (
        <Card title="Historique des versions" className="ad-section" flush>
          <table className="ad-table">
            <thead><tr><th>Version</th><th>Date</th><th>Note</th><th /></tr></thead>
            <tbody>
              {versions.map((item) => (
                <tr key={item.id}>
                  <td>v{item.version} {item.isActive && <span className="ad-chip ad-chip--ok">Active</span>}</td>
                  <td>{formatDateTime(item.createdAt)}</td>
                  <td>{item.note ?? "—"}</td>
                  <td className="ad-actions">{!item.isActive && <ConfirmAction action={restoreBaremes} fields={{ version: String(item.version) }} label="Restaurer" variant="outline" message={`Restaurer la version ${item.version} ? Elle deviendra une nouvelle version active.`} confirmLabel="Restaurer" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </main>
  );
}
