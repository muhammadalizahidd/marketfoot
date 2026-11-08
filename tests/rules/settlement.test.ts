import assert from "node:assert/strict";
import test from "node:test";

import { calculateMercadoDemandDelta, calculateSettlementEffect, distributeEarnings } from "../../src/rules";

const starter = { snapshotId: "snapshot", gamerId: "gamer", playerId: "player", clubId: "club", position: "GK" as const, isStarter: true, isCaptain: false };
const cleanWin = { started: true, minutesPlayed: 90, goals: 1, assists: 0, ownGoals: 0, yellowCards: 0, redCards: 0, penaltiesScored: 0, penaltiesMissed: 0, penaltiesSaved: 0, saves: 0, substitutionsOut: 0 };

test("settlement applies starter barème, team result, captain and 70/30 distribution", () => {
  const result = calculateSettlementEffect({ ...starter, isCaptain: true }, cleanWin, { isPostponed: false, goalsConceded: 0, teamResult: "home_win" });
  assert.ok(result);
  assert.equal(result.normalEffect, 460_000);
  assert.equal(result.captainAdjustment, 460_000);
  assert.equal(result.gamerEffect, 920_000);
  assert.deepEqual({ budget: result.budgetDelta, locked: result.lockedAccountDelta }, { budget: 644_000, locked: 276_000 });
});

test("negative earnings debit only the transfer budget", () => {
  assert.deepEqual(distributeEarnings(-200_000), { budget: -200_000, lockedAccount: 0 });
});

test("postponed fixtures defer original matchday settlement", () => {
  assert.equal(calculateSettlementEffect(starter, cleanWin, { isPostponed: true }), null);
});

test("non-selected players use the substitute barème while retaining their match facts", () => {
  const result = calculateSettlementEffect({ ...starter, isStarter: false }, cleanWin, { isPostponed: false, goalsConceded: 0, teamResult: "home_win" });
  assert.ok(result);
  assert.equal(result.normalEffect, 380_000);
});

test("Mercado demand applies the configured €10k net-order movement", () => {
  assert.equal(calculateMercadoDemandDelta(5, 2), 30_000);
  assert.equal(calculateMercadoDemandDelta(1, 4), -30_000);
});
