import assert from "node:assert/strict";
import test from "node:test";

import { calculatePlayerMatchEffect, explainPlayerMatchEffect, teamResultEffects, teamResultOf } from "../../src/rules";

const base = { started: true, minutesPlayed: 90, goals: 0, assists: 0, ownGoals: 0, yellowCards: 0, redCards: 0, penaltiesScored: 0, penaltiesMissed: 0, penaltiesSaved: 0, saves: 0 };

test("itemised breakdown always adds up to the match effect", () => {
  const cases = [
    { position: "FW" as const, input: { ...base, goals: 1, assists: 1, yellowCards: 1, goalsConceded: 0 } },
    { position: "GK" as const, input: { ...base, saves: 4, goalsConceded: 3, redCards: 1 } },
    { position: "MF" as const, input: { ...base, started: false, minutesPlayed: 25, goals: 2, penaltiesScored: 1, penaltiesMissed: 1, ownGoals: 1, goalsConceded: 1 } },
    { position: "DF" as const, input: { ...base, substitutionsOut: 1, minutesPlayed: 70, goalsConceded: 0 } },
    { position: "DF" as const, input: { ...base, minutesPlayed: 0, started: false } },
  ];
  for (const { position, input } of cases) {
    const team = teamResultEffects[teamResultOf(false, 2, 1)];
    const explained = explainPlayerMatchEffect(position, input, team);
    assert.equal(explained.total, calculatePlayerMatchEffect(position, input) + (input.minutesPlayed === 0 ? 0 : team));
    assert.equal(explained.lines.reduce((sum, line) => sum + line.amount, 0), explained.total);
  }
});

test("team result follows home/away barème", () => {
  assert.equal(teamResultOf(true, 2, 0), "home_win");
  assert.equal(teamResultOf(false, 0, 0), "away_draw");
  assert.equal(teamResultOf(false, 0, 3), "away_loss");
});
