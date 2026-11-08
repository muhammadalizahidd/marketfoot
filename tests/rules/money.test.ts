import test from "node:test";
import assert from "node:assert/strict";
import { moneySum,moneyRatio } from "../../src/rules/money";
test("money arithmetic preserves cents",()=>{assert.equal(moneySum(0.1,0.2),0.3);assert.equal(moneyRatio(1250,8,100),100);});
test("undefined sub-cent rounding fails explicitly",()=>{assert.throws(()=>moneyRatio(0.01,7,100),/arrondi/);});
