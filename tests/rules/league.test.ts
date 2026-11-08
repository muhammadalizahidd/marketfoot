import test from "node:test";
import assert from "node:assert/strict";
import { calculateStandings } from "../../src/rules/league";
import { validateDirectTransfer } from "../../src/rules/transfers";
const clubs=[{id:"a",name:"A"},{id:"b",name:"B"}];
const fixture={home_club_id:"a",away_club_id:"b",home_score:2,away_score:1,is_postponed:false,kickoff_at:"2026-09-20T18:00:00Z"};
test("standings exclude postponed and incomplete fixtures",()=>{
  const rows=calculateStandings(clubs,[fixture,{...fixture,is_postponed:true},{...fixture,home_score:null}]);
  assert.equal(rows[0].points,3);assert.equal(rows[0].played,1);assert.equal(rows[1].goalsAgainst,2);
});
test("home and away filters apply only to the selected side",()=>{
  assert.equal(calculateStandings(clubs,[fixture],"home").find(c=>c.id==="b")?.played,0);
  assert.equal(calculateStandings(clubs,[fixture],"away").find(c=>c.id==="a")?.played,0);
});
test("a negative budget may improve without becoming positive",()=>{
  assert.equal(validateDirectTransfer({budget:-2000000,soldValue:2000000,boughtValue:1000000,matchday:1,transfersAlreadyMade:0}).ok,true);
  assert.equal(validateDirectTransfer({budget:-2000000,soldValue:1000000,boughtValue:2000000,matchday:1,transfersAlreadyMade:0}).ok,false);
});
