import assert from "node:assert/strict";
import test from "node:test";

import { honoursBand, honoursPoints, trophySlotCount } from "../../src/rules";

test("honours bands follow 1st, 2nd, 3rd, 4-10, 11-20, 21-30, 31-50, 51-100", () => {
  assert.deepEqual([1, 2, 3, 4, 10, 11, 20, 21, 30, 31, 50, 51, 100, 101].map(honoursBand), [1, 2, 3, 10, 10, 20, 20, 30, 30, 50, 50, 100, 100, null]);
});

test("honours points follow Game Rules v2 section 15", () => {
  assert.equal(honoursPoints("overall", 1), 300);
  assert.equal(honoursPoints("overall", 7), 150);
  assert.equal(honoursPoints("primes", 22), 20);
  assert.equal(honoursPoints("predictions", 100), 4);
  assert.equal(honoursPoints("first_half", 4), 0);
  assert.equal(honoursPoints("matchday_predictions", 1), 5);
  assert.equal(honoursPoints("matchday_predictions", 2), 0);
});

test("trophy catalogue has one slot per band shown on the Palmarès screen", () => {
  assert.equal(trophySlotCount, 8 + 3 + 8 + 8 + 8 + 1);
});
