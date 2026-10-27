import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

// Exercise the actual browser calculator, not a duplicated implementation.
const html = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../ideas-risk-budget.html'), 'utf8');
const script = html.match(/<script>\s*([\s\S]*?)<\/script>\s*<\/body>/)?.[1];
assert.ok(script, 'Risk budget inline script must exist');
const start = script.indexOf('function compute(');
const end = script.indexOf('function render(');
assert.ok(start >= 0 && end > start, 'Pure compute() must remain available');
const { compute } = runInNewContext(script.slice(start, end) + '\n({compute})');
const approx = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7,
  `Expected ${actual} to equal ${expected}`);

const p = (ticker, amount, stop) => ({ ticker, amount, stop });

test('browser JavaScript parses', () => {
  assert.doesNotThrow(() => new Function(script));
});

test('shared 10% allocation and 0.5% loss budget are enforced independently', () => {
  const r = compute(1_000_000, 10, 0.5, [p('A', 50_000, 4), p('B', 50_000, 6)]);
  approx(r.budget, 100_000);
  approx(r.allocated, 100_000);
  approx(r.remaining, 0);
  approx(r.riskUsd, 5_000);
  approx(r.lossLimit, 5_000);
  assert.equal(r.withinBudget, true);
  assert.equal(r.withinRisk, true);
  approx(r.largestPct, 5);
});

test('overspending the shared pool is rejected even if stops are safe', () => {
  const r = compute(1_000_000, 10, 0.5, [p('A', 60_000, 1), p('B', 50_000, 1)]);
  approx(r.remaining, -10_000);
  assert.equal(r.withinBudget, false);
  assert.equal(r.withinRisk, true);
});

test('default example correctly warns about a $100 stop-risk breach', () => {
  const r = compute(1_000_000, 10, 0.5, [
    p('NVDA', 25_000, 5), p('AMZN', 25_000, 5),
    p('QQQ', 30_000, 4), p('XBI', 20_000, 7)
  ]);
  approx(r.riskUsd, 5_100);
  assert.equal(r.withinBudget, true);
  assert.equal(r.withinRisk, false);
});

test('missing stop never counts as zero risk', () => {
  const r = compute(1_000_000, 10, 0.5, [p('A', 20_000, null), p('B', 10_000, 2)]);
  assert.equal(r.missing, 1);
  approx(r.riskUsd, 200);
  assert.equal(r.withinRisk, false);
  assert.equal(r.details[0].loss, null);
});

test('zero-valued stop is distinct from an absent stop', () => {
  const r = compute(1_000_000, 10, 0.5, [p('A', 20_000, 0)]);
  assert.equal(r.missing, 0);
  approx(r.riskUsd, 0);
  assert.equal(r.withinRisk, true);
});

test('empty portfolio positions are mathematically well-defined', () => {
  const r = compute(1_000_000, 0, 0, []);
  assert.equal(r.withinBudget, true);
  assert.equal(r.withinRisk, true);
  approx(r.allocated, 0);
  approx(r.largestPct, 0);
});

test('invalid portfolio size and percentages are rejected', () => {
  assert.throws(() => compute(0, 10, 0.5, []), /Проверь/);
  assert.throws(() => compute(NaN, 10, 0.5, []), /Проверь/);
  assert.throws(() => compute(1_000_000, 101, 0.5, []), /Проверь/);
  assert.throws(() => compute(1_000_000, 10, -1, []), /Проверь/);
});

test('invalid amounts, stops and missing tickers are rejected', () => {
  const base = (row) => compute(1_000_000, 10, 0.5, [row]);
  assert.throws(() => base(p('A', -1, 5)), /Проверь/);
  assert.throws(() => base(p('A', Infinity, 5)), /Проверь/);
  assert.throws(() => base(p('A', 100, 101)), /Стоп/);
  assert.throws(() => base(p('A', 100, NaN)), /Стоп/);
  assert.throws(() => base(p(' ', 100, 5)), /Проверь/);
});

test('more than 30 positions are rejected', () => {
  assert.throws(() => compute(1_000_000, 10, 0.5, Array.from({ length: 31 }, (_, i) => p(`A${i}`, 1, 5))), /Максимум 30/);
});

test('large finite portfolios never create infinite allocation or stop-loss limits', () => {
  const r = compute(1e308, 10, 10, [p('A', 1_000, 5)]);
  assert.ok(Number.isFinite(r.budget), 'Allocation budget must remain finite');
  assert.ok(Number.isFinite(r.lossLimit), 'Stop-loss budget must remain finite');
  assert.ok(Math.abs(r.budget / 1e307 - 1) < 1e-12);
  assert.ok(Math.abs(r.lossLimit / 1e307 - 1) < 1e-12);
  assert.equal(r.withinBudget, true);
  assert.equal(r.withinRisk, true);

  const max = compute(Number.MAX_VALUE, 100, 100, []);
  assert.equal(max.budget, Number.MAX_VALUE);
  assert.equal(max.lossLimit, Number.MAX_VALUE);

  const tiny = compute(Number.MIN_VALUE, 100, 100, []);
  assert.equal(tiny.budget, Number.MIN_VALUE);
  assert.equal(tiny.lossLimit, Number.MIN_VALUE);
});

test('blank required numbers fail closed and clear stale summaries and exports', () => {
  const ids=['positions','portfolio','pool','risk','budget','allocated','remaining','budget-status','risk-status','portfolio-risk','largest','copy','print'];
  const defaults={portfolio:'1000000',pool:'10',risk:'0.5'};
  const nodes=Object.fromEntries(ids.map(id=>[id,{value:defaults[id]??'',textContent:'',className:'',disabled:false}]));
  nodes.positions.children=[];
  const browserSource=script.slice(0,script.indexOf("$('portfolio').oninput=render;"));
  assert.ok(browserSource.includes('function calculate()'), 'Test actual browser calculation handler');
  const {calculate}=runInNewContext(browserSource+'\n({calculate})',{
    document:{getElementById(id){assert.ok(nodes[id], 'Known element: '+id);return nodes[id]}}
  });
  calculate();
  assert.notEqual(nodes.budget.textContent,'—');
  assert.equal(nodes.copy.disabled,false);
  assert.equal(nodes.print.disabled,false);
  for(const id of ['pool','risk','portfolio']){
    const previous=nodes[id].value;
    nodes[id].value='';
    calculate();
    for(const metric of ['budget','allocated','remaining'])assert.equal(nodes[metric].textContent,'—');
    assert.equal(nodes['portfolio-risk'].textContent,'');
    assert.equal(nodes.largest.textContent,'');
    assert.equal(nodes.copy.disabled,true);
    assert.equal(nodes.print.disabled,true);
    assert.match(nodes['budget-status'].textContent,/Проверь/);
    nodes[id].value=previous;
    calculate();
    assert.notEqual(nodes.budget.textContent,'—');
    assert.equal(nodes.copy.disabled,false);
    assert.equal(nodes.print.disabled,false);
  }
  nodes.risk.value='0';
  calculate();
  assert.equal(nodes.print.disabled,false,'Explicit zero remains valid');
});

test('risk budget row percentages and stop-loss cells refresh after edits, and clear on invalid input', () => {
  // Run the actual browser calculate() and derived-cell renderer with synthetic DOM rows.
  const ids=['portfolio','pool','risk','positions','budget','allocated','remaining','budget-status','risk-status','portfolio-risk','largest','copy','print'];
  const nodes=Object.fromEntries(ids.map(id=>[id,{value:({portfolio:'1000000',pool:'10',risk:'0.5'})[id]??'',textContent:'',className:'',disabled:false}]));
  const tableRows=Array.from({length:4},()=>({children:Array.from({length:5},()=>({textContent:''}))}));
  nodes.positions.children=tableRows;
  const source=script.slice(0,script.indexOf("$('portfolio').oninput=render;"));
  const {calculate,rows}=runInNewContext(source+'\n({calculate,rows})',{
    document:{getElementById(id){assert.ok(nodes[id], 'Known element: '+id);return nodes[id]}}
  });
  calculate();
  assert.equal(tableRows[0].children[3].textContent,'2.50%');
  assert.equal(tableRows[0].children[4].textContent,'$1,250.00');
  rows[0].amount=40000;
  rows[0].stop=10;
  calculate();
  assert.equal(tableRows[0].children[3].textContent,'4.00%');
  assert.equal(tableRows[0].children[4].textContent,'$4,000.00');
  rows[0].stop=null;
  calculate();
  assert.equal(tableRows[0].children[4].textContent,'Не указан');
  nodes.portfolio.value='';
  calculate();
  assert.equal(tableRows[0].children[3].textContent,'—');
  assert.equal(tableRows[0].children[4].textContent,'—');
  assert.equal(nodes.copy.disabled,true);
  assert.equal(nodes.print.disabled,true);
  assert.match(script,/input\.addEventListener\('input',\(\)=>\{[^\n]*calculate\(\)/);
});

test('copy feedback is reset after edits and late clipboard success cannot mark a stale calculation as copied', async () => {
  const ids=['portfolio','pool','risk','positions','budget','allocated','remaining','budget-status','risk-status','portfolio-risk','largest','copy','print','add','example'];
  const nodes=Object.fromEntries(ids.map(id=>[id,{value:({portfolio:'1000000',pool:'10',risk:'0.5'})[id]??'',textContent:'',className:'',disabled:false}]));
  nodes.positions.children=Array.from({length:4},()=>({children:Array.from({length:5},()=>({textContent:''}))}));
  let mode='immediate', resolvePending;
  const browserSource=script.slice(0,script.lastIndexOf('\nrender();'));
  assert.ok(browserSource.includes("if(result===r)$('copy').textContent='Скопировано ✓'"));
  const {calculate}=runInNewContext(browserSource+'\n({calculate})',{
    document:{getElementById(id){assert.ok(nodes[id], 'Known element: '+id);return nodes[id]}},
    navigator:{clipboard:{writeText(){return mode==='deferred'?new Promise(resolve=>{resolvePending=resolve}):Promise.resolve()}}},
    window:{print(){}}
  });
  calculate();
  const defaultLabel='Копировать расчёт для Advisor AI';
  assert.equal(nodes.copy.textContent,defaultLabel);
  await nodes.copy.onclick();
  assert.equal(nodes.copy.textContent,'Скопировано ✓');
  nodes.pool.value='9';
  calculate();
  assert.equal(nodes.copy.textContent,defaultLabel,'New calculation must clear the previous copied badge');
  mode='deferred';
  const pending=nodes.copy.onclick();
  assert.equal(typeof resolvePending,'function');
  nodes.pool.value='10';
  calculate();
  resolvePending();
  await pending;
  assert.equal(nodes.copy.textContent,defaultLabel,'Old clipboard completion must not mark new numbers as copied');
});


test('zero allocation and stop-loss caps reject even tiny positive exposure', () => {
  const tiny = compute(1_000_000, 0, 0, [p('TINY', 0.0000005, 100)]);
  assert.equal(tiny.withinBudget, false);
  assert.equal(tiny.withinRisk, false);
  assert.ok(tiny.remaining < 0);
  const empty = compute(1_000_000, 0, 0, []);
  assert.equal(empty.withinBudget, true);
  assert.equal(empty.withinRisk, true);
});

test('positive caps tolerate only floating-point roundoff, not actual over-allocation', () => {
  const rounding = compute(1, 30, 30, [p('A', 0.1, 100), p('B', 0.2, 100)]);
  assert.equal(rounding.withinBudget, true);
  assert.equal(rounding.withinRisk, true);
  const exceeded = compute(1, 30, 30, [p('A', 0.1, 100), p('B', 0.200001, 100)]);
  assert.equal(exceeded.withinBudget, false);
  assert.equal(exceeded.withinRisk, false);
});

test('unrepresentable portfolio percentages fail closed instead of showing Infinity', () => {
  assert.throws(() => compute(1e-300, 10, 10, [p('A', 1e12, 5)]), /Невозможно рассчитать долю позиции/);
  const empty = compute(Number.MIN_VALUE, 100, 100, []);
  assert.equal(empty.largestPct, 0, 'An empty portfolio remains mathematically valid');
  const normal = compute(1_000_000, 10, 0.5, [p('A', 25_000, 5)]);
  assert.equal(normal.details[0].portfolioPct, 2.5);
});
