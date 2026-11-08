import { marketfootRulesConfig } from "./config";
import { getRulesSettings } from "./settings";
import type { RuleResult } from "./types";
import { moneyRatio, moneySum } from "./money";

export type TransferMode = "direct" | "mercado";

/** Source §9.1. Rates stay configurable because §10 records conflicting source schedules. */
export function getTransferTaxRate(matchday: number, mode: TransferMode): number {
  if (!Number.isInteger(matchday) || matchday < 1) throw new Error("La journée doit être un entier positif.");
  const schedule = getRulesSettings().transfers.tax[mode];
  return schedule.find((entry) => matchday <= entry.throughMatchday)?.rate ?? schedule.at(-1)!.rate;
}

/** Source §9.2: budget + value sold must cover the purchase value plus tax. */
export function validateDirectTransfer(input: { budget: number; soldValue: number; boughtValue: number; matchday: number; transfersAlreadyMade: number }): RuleResult<{ tax: number; resultingBudget: number }> {
  if (input.transfersAlreadyMade >= marketfootRulesConfig.transfers.quotaPerMatchday) return { ok: false, code: "TRANSFER_QUOTA", message: "Le quota de 4 transferts entre deux journées est atteint." };
  const tax = moneyRatio(input.boughtValue,Math.round(getTransferTaxRate(input.matchday,"direct")*100),100);
  const resultingBudget = moneySum(input.budget,input.soldValue,-input.boughtValue,-tax);
  if (resultingBudget < 0 && (input.budget >= 0 || resultingBudget <= input.budget)) return { ok: false, code: "INSUFFICIENT_BUDGET", message: "Le transfert doit couvrir ses frais ou réduire votre budget négatif." };
  return { ok: true, value: { tax, resultingBudget } };
}

/** Source §12.1 / §12.2. Commission remains configurable because worked examples conflict. */
export function calculateMercadoOrderCost(input: { soldValue: number; boughtValue: number; matchday: number }): { tax: number; fixedCommission: number; netBudgetChange: number } {
  const tax = moneyRatio(input.boughtValue,Math.round(getTransferTaxRate(input.matchday,"mercado")*100),100);
  const fixedCommission = getRulesSettings().transfers.fixedMercadoCommission;
  return { tax, fixedCommission, netBudgetChange: moneySum(input.soldValue,-input.boughtValue,-tax,-fixedCommission) };
}

export function validateMercadoOrder(input: { availableMercadoBudget: number; soldValue: number; boughtValue: number; matchday: number; transfersAlreadyMade: number }): RuleResult<{ tax: number; fixedCommission: number; resultingMercadoBudget: number }> {
  if (input.transfersAlreadyMade >= marketfootRulesConfig.transfers.quotaPerMatchday) return { ok: false, code: "TRANSFER_QUOTA", message: "Le quota de 4 transferts entre deux journées est atteint." };
  const cost = calculateMercadoOrderCost(input);
  const resultingMercadoBudget = moneySum(input.availableMercadoBudget,cost.netBudgetChange);
  if (resultingMercadoBudget < 0) return { ok: false, code: "MERCADO_BUDGET", message: "Votre budget Mercado ne couvre pas cet ordre." };
  return { ok: true, value: { tax: cost.tax, fixedCommission: cost.fixedCommission, resultingMercadoBudget } };
}

/** Source §13: the window-wide value movement is half the €20k buy/sell demand effect. */
export function calculateMercadoDemandDelta(purchases: number, sales: number): number {
  if (!Number.isInteger(purchases) || !Number.isInteger(sales) || purchases < 0 || sales < 0) throw new Error("Les volumes Mercado doivent être des entiers positifs.");
  const { impactBuy, impactSale, mercadoSharePct } = getRulesSettings().transfers;
  return ((purchases * impactBuy - sales * impactSale) * mercadoSharePct) / 100;
}
