#!/usr/bin/env node
// Regression suite for the EXACT deterministic portfolio formulas served by portfolio-report.html.
// No market feeds, credentials, browser automation or personal financial records.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../portfolio-report.html',import.meta.url),'utf8');
const begin=html.indexOf('function parseSaved(');
const end=html.indexOf('function renderComparison(',begin);
assert.ok(begin>=0&&end>begin,'Portfolio analysis functions must exist in production source');
const shared="const PORT_START='[ADVISOR_AI_PORTFOLIO_BEGIN]',PORT_END='[ADVISOR_AI_PORTFOLIO_END]';\n";
const {parseSaved,projectAllocation,customPortfolioStress,combinedPortfolioStress} =
 new Function(shared+html.slice(begin,end)+'return {parseSaved,projectAllocation,customPortfolioStress,combinedPortfolioStress};')();
function checkNear(actual,expected,label){assert.ok(Number.isFinite(actual)&&Math.abs(actual-expected)<1e-7,label+': expected '+expected+', got '+actual)}
function saved(targetLine='Целевая доля облигаций 40%'){
 return ['[ADVISOR_AI_PORTFOLIO_BEGIN]','Список позиций (тикер; количество; цена в USD):','NVDA;7000;100','BOND:UST10;3000;100;5','Итого: 1000000',targetLine,'[ADVISOR_AI_PORTFOLIO_END]'].join('\n');
}
const p=parseSaved(saved());
assert.equal(p.total,1_000_000);
assert.equal(p.bondValue,300_000);
assert.equal(p.equityValue,700_000);
assert.equal(p.target,40);
checkNear(p.duration,5,'Duration');
const r=customPortfolioStress(p,-15,75);
checkNear(r.current.equityChangeUsd,-105_000,'Current equity shock');
checkNear(r.current.bondChangeUsd,-11_250,'Current bond shock');
checkNear(r.current.changeUsd,-116_250,'Current PnL');
checkNear(r.current.portfolioPct,-11.625,'Current percent');
checkNear(r.after.changeUsd,-105_000,'Target rebalance PnL');
checkNear(r.after.portfolioPct,-10.5,'Target rebalance percent');
checkNear(r.after.stressedValue,895_000,'Target stressed assets');
assert.equal(customPortfolioStress(parseSaved(saved('Целевая доля не указана')),-15,75).after,null,'No target is allowed without fabricated answer');
assert.equal(customPortfolioStress({...p,target:100},0,100).after.changeUsd,-50_000,'All-bond target');
assert.equal(customPortfolioStress({...p,target:0},-10,100).after.changeUsd,-100_000,'All-equity target');
assert.equal(customPortfolioStress(p,0,0).current.changeUsd,0,'Zero shock');
assert.throws(()=>customPortfolioStress(p,-101,100),/от −100%/);
assert.throws(()=>customPortfolioStress(p,20,1001),/1000/);
assert.throws(()=>customPortfolioStress(p,NaN,100),/Укажи изменение/);
assert.throws(()=>parseSaved(saved('Целевая доля облигаций 105%')),/от 0 до 100/);
const noBonds=parseSaved(['[ADVISOR_AI_PORTFOLIO_BEGIN]','Список позиций (тикер; количество; цена в USD):','NVDA;10;100','Итого: 1000','Целевая доля облигаций 40%','[ADVISOR_AI_PORTFOLIO_END]'].join('\n'));
assert.equal(projectAllocation(noBonds,40).possible,false,'Do not invent bond holdings');
const negative=combinedPortfolioStress({total:1_000_000,bondValue:1_000_000,equityValue:0,duration:30},0,1000);
assert.ok(negative.stressedValue<0,'Extreme linear outcome must remain identifiable as a modeling artefact');
console.log('PASS: current and target portfolio stress, dollar and percent losses, missing classes, bounds, and extreme shocks');
