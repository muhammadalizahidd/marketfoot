import test from "node:test";
import assert from "node:assert/strict";
import { calculateGamerResultPct, calculateMatchdayAveragePct, calculatePredictionEarnings, getMatchOutcome } from "../../src/rules";

test("match outcome follows 1/N/2", () => { assert.equal(getMatchOutcome(2, 1), "1"); assert.equal(getMatchOutcome(1, 1), "N"); assert.equal(getMatchOutcome(0, 3), "2"); });
test("forgotten prediction stays in the denominator", () => { assert.equal(calculateGamerResultPct(9, 10), 90); assert.throws(() => calculateGamerResultPct(1, 0)); });
test("average over the population", () => { assert.equal(calculateMatchdayAveragePct([50, 70, 90]), 70); });
test("x = 0 pays the base amount split 70/30", () => {
  const r = calculatePredictionEarnings(50, 50);
  assert.equal(r.x, 0); assert.equal(r.earnings, 480_000); assert.equal(r.budgetDelta, 336_000); assert.equal(r.lockedAccountDelta, 144_000);
});
test("payout is clamped to +-2M", () => {
  assert.equal(calculatePredictionEarnings(100, 20).earnings, 2_000_000);
  assert.equal(calculatePredictionEarnings(0, 100).earnings, -2_000_000);
});
test("negative payout goes 100% to budget", () => {
  const r = calculatePredictionEarnings(0, 100);
  assert.equal(r.budgetDelta, -2_000_000); assert.equal(r.lockedAccountDelta, 0);
});
test("0% result never earns a positive payout", () => { assert.equal(calculatePredictionEarnings(0, 10).earnings, 0); });
test("source worked example: x is 14, not 24", () => {
  const r = calculatePredictionEarnings(70, 56);
  assert.equal(r.x, 14); assert.equal(r.earnings, Math.round(((0.008 * 14 ** 3) + 8 * 14 + 400) * 1200));
});
