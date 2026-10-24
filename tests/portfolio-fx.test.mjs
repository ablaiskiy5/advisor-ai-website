import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const html=readFileSync(new URL('../portfolio-report.html',import.meta.url),'utf8');
const start=html.indexOf('function kztCashFxScenario('),end=html.indexOf('function portfolioCoverageLines(',start);
assert.ok(start>0&&end>start,'production FX scenario function exists');
const scenario=runInNewContext(html.slice(start,end)+'\nkztCashFxScenario');
const sample={cashKzt:50000,fxKzt:500,cashUsd:50,debtUsd:20,total:200};
test('KZT depreciation decreases USD value and estimated NAV',()=>{
 const result=scenario(sample,10);
 assert.ok(Math.abs(result.beforeUsd-100)<1e-9);
 assert.ok(Math.abs(result.afterUsd-50000/550)<1e-9);
 assert.ok(result.deltaUsd<0);
 assert.ok(Math.abs(result.nav-330)<1e-9);
 assert.ok(result.navChangePct<0);
});
test('KZT appreciation increases USD value',()=>{
 const result=scenario(sample,-10);
 assert.ok(Math.abs(result.afterUsd-50000/450)<1e-9);
 assert.ok(result.deltaUsd>0);
});
test('unknown NAV and absent KZT are never invented',()=>{
 assert.equal(scenario({...sample,cashKzt:null},10),null);
 assert.equal(scenario({...sample,cashUsd:null},10).navChangePct,null);
 assert.throws(()=>scenario(sample,-100),/валютного сценария/);
});
test('FX scenario visible in printable report and disclosure updated',()=>{
 assert.match(html,/id="r-fx-risk"/);
 assert.match(html,/Валютная чувствительность денежных средств KZT/);
 assert.doesNotMatch(html,/отсутствие денежного остатка, обязательств, валютных пересчётов/);
});

test('zero and negative NAV suppress misleading FX percentages while retaining USD impact',()=>{
 const zero=scenario({...sample,debtUsd:350},10);
 assert.equal(zero.nav,0);
 assert.equal(zero.navChangePct,null);
 assert.ok(zero.deltaUsd<0);
 const negative=scenario({...sample,debtUsd:400},10);
 assert.equal(negative.nav,-50);
 assert.equal(negative.navChangePct,null);
 assert.ok(negative.deltaUsd<0);
 assert.match(html,/NAV равен нулю или отрицателен/);
});
