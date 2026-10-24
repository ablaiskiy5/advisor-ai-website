import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../workspace.html',import.meta.url),'utf8');
const start=html.indexOf('function savedPortfolioAmount('),end=html.indexOf('function portfolioPanel(',start);
assert.ok(start>0&&end>start);
const savedPortfolioAmount=new Function('PORT_START','PORT_END',html.slice(start,end)+';return savedPortfolioAmount;')('[ADVISOR_AI_PORTFOLIO_BEGIN]','[ADVISOR_AI_PORTFOLIO_END]');
const notes=['[ADVISOR_AI_PORTFOLIO_BEGIN]','Денежные средства 50.25 USD','Обязательства 0 USD','[ADVISOR_AI_PORTFOLIO_END]'].join(String.fromCharCode(10));
test('cash and liabilities restore from saved notes',()=>{
 assert.equal(savedPortfolioAmount(notes,'Денежные средства'),'50.25');
 assert.equal(savedPortfolioAmount(notes,'Обязательства'),'0');
 assert.equal(savedPortfolioAmount('legacy','Денежные средства'),'');
});
test('workspace exposes optional amounts and saves them',()=>{
 assert.match(html,/id="cash-usd"/);
 assert.match(html,/id="debt-usd"/);
 assert.match(html,/summary\\.cashUsd===undefined/);
 assert.match(html,/summary\\.debtUsd===undefined/);
});
