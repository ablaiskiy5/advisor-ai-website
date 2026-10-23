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
