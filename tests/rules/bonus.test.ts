import test from "node:test";
import assert from "node:assert/strict";
import { calculateBonusAmount, isBonusSuccessful, type BonusPlayer } from "../../src/rules";

const base: BonusPlayer = { position: "MF", isStarter: true, played: true, startedMatch: true, goals: 0, assists: 0, penaltiesScored: 0, stoppageTimeGoals: 0, teamGoalsFor: 0, teamGoalsAgainst: 0, postponed: false };
const p = (patch: Partial<BonusPlayer>): BonusPlayer => ({ ...base, ...patch });

test("cholismo needs two starters whose team won 1-0", () => {
  assert.equal(isBonusSuccessful("cholismo", [p({ teamGoalsFor: 1 }), p({ teamGoalsFor: 1 })]), true);
  assert.equal(isBonusSuccessful("cholismo", [p({ teamGoalsFor: 1 }), p({ teamGoalsFor: 2 })]), false);
  assert.equal(isBonusSuccessful("cholismo", [p({ teamGoalsFor: 1 }), p({ teamGoalsFor: 1, isStarter: false })]), false);
});
test("turpin: a starter scores a penalty", () => {
  assert.equal(isBonusSuccessful("turpin", [p({ penaltiesScored: 1 })]), true);
  assert.equal(isBonusSuccessful("turpin", [p({ penaltiesScored: 1, isStarter: false })]), false);
});
test("clean sheets: the starting goalkeeper wins without conceding", () => {
  assert.equal(isBonusSuccessful("clean-sheets", [p({ position: "GK", teamGoalsFor: 2 })]), true);
  assert.equal(isBonusSuccessful("clean-sheets", [p({ position: "GK", teamGoalsFor: 0 })]), false);
  assert.equal(isBonusSuccessful("clean-sheets", [p({ position: "GK", teamGoalsFor: 2, teamGoalsAgainst: 1 })]), false);
});
test("sorti du frigo: a line-up starter who came off the bench scores", () => {
  assert.equal(isBonusSuccessful("sorti-du-frigo", [p({ startedMatch: false, goals: 1 })]), true);
  assert.equal(isBonusSuccessful("sorti-du-frigo", [p({ startedMatch: true, goals: 1 })]), false);
});
test("caviar en stock: two assists in the same match", () => {
  assert.equal(isBonusSuccessful("caviar-en-stock", [p({ assists: 2 })]), true);
  assert.equal(isBonusSuccessful("caviar-en-stock", [p({ assists: 1 }), p({ assists: 1 })]), false);
});
test("fergie time: a stoppage-time goal; postponed matches never count", () => {
  assert.equal(isBonusSuccessful("fergie-time", [p({ stoppageTimeGoals: 1 })]), true);
  assert.equal(isBonusSuccessful("fergie-time", [p({ stoppageTimeGoals: 1, postponed: true })]), false);
});
test("bonus pays 10% of positive starters' primes only", () => {
  assert.equal(calculateBonusAmount(1_000_000), 100_000);
  assert.equal(calculateBonusAmount(-500_000), 0);
  assert.equal(calculateBonusAmount(0), 0);
});

import { foldBonusIntoEffects, type BonusEffectRow } from "../../src/rules";

const row = (patch: Partial<BonusEffectRow>): BonusEffectRow => ({ gamerId: "g1", gamerEffect: 0, budgetDelta: 0, lockedAccountDelta: 0, calculation: { isStarter: true }, ...patch });
test("a successful bonus is folded into the largest starter row and keeps every row balanced", () => {
  const rows = [row({ gamerEffect: 1_000_000, budgetDelta: 700_000, lockedAccountDelta: 300_000 }), row({ gamerEffect: 500_000, budgetDelta: 350_000, lockedAccountDelta: 150_000 }), row({ gamerEffect: 9_000_000, budgetDelta: 6_300_000, lockedAccountDelta: 2_700_000, calculation: { isStarter: false } })];
  const amount = foldBonusIntoEffects(rows, "g1", "turpin", true);
  assert.equal(amount, 150_000, "10% of the starters' 1.5M (the bench row is ignored)");
  assert.equal(rows[0].gamerEffect, 1_150_000); assert.equal(rows[0].budgetDelta, 805_000); assert.equal(rows[0].lockedAccountDelta, 345_000);
  for (const r of rows) assert.equal(r.budgetDelta + r.lockedAccountDelta, r.gamerEffect, "each row stays balanced");
  assert.equal(rows[0].bonusAdjustment, 150_000); assert.equal(rows[0].calculation.bonus, "turpin");
  assert.equal(rows[2].gamerEffect, 9_000_000, "the bench row is untouched");
});
test("no bonus when it fails, when starters earned nothing, or for another gamer", () => {
  const rows = [row({ gamerEffect: 1_000_000, budgetDelta: 700_000, lockedAccountDelta: 300_000 })];
  assert.equal(foldBonusIntoEffects(rows, "g1", "turpin", false), 0);
  assert.equal(foldBonusIntoEffects(rows, "other", "turpin", true), 0);
  const negative = [row({ gamerEffect: -400_000, budgetDelta: -400_000 })];
  assert.equal(foldBonusIntoEffects(negative, "g1", "turpin", true), 0, "never a negative bonus");
  assert.equal(rows[0].gamerEffect, 1_000_000);
});
