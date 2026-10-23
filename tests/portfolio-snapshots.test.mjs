import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const html = readFileSync(new URL('../workspace.html', import.meta.url), 'utf8');
function productionFunction(name, nextName) {
  const start = html.indexOf('function ' + name + '(');
  const end = html.indexOf('function ' + nextName + '(', start);
  assert.ok(start >= 0 && end > start, 'Missing production function ' + name);
  return html.slice(start, end);
}
const { parseHoldings, snapshotDiff } = runInNewContext(
  productionFunction('parseHoldings', 'savedHoldings') + '\n' +
  productionFunction('snapshotDiff', 'snapshotUi') + '\n({parseHoldings,snapshotDiff})'
);
const profile = holdings => ({ data: parseHoldings(holdings) });
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, actual + ' != ' + expected);

test('snapshot portfolio arithmetic: concentration, bond duration and 100bp stress', () => {
  const p = parseHoldings('AAPL; 10; 100\nBOND:UST2030; 2; 950; 4');
  assert.equal(p.total, 2900);
  assert.equal(p.bondValue, 1900);
  assert.equal(p.equityValue, 1000);
  near(p.hhi, (1000 / 2900) ** 2 + (1900 / 2900) ** 2);
  near(p.bondDuration, 4);
  near(p.rateShock100bp, -1900 * 4 * 0.01 / 2900);
});

test('quantity and price changes are visible even if market value is unchanged', () => {
  const d = snapshotDiff(profile('AAPL; 10; 100'), profile('AAPL; 20; 50'));
  assert.equal(d.changes.length, 1);
  assert.equal(d.changes[0].oldValue, 1000);
  assert.equal(d.changes[0].newValue, 1000);
  assert.equal(d.changes[0].oldQty, 10);
  assert.equal(d.changes[0].newQty, 20);
  assert.equal(d.changes[0].oldPrice, 100);
  assert.equal(d.changes[0].newPrice, 50);
});

test('duration-only bond changes are visible with identical price and quantity', () => {
  const d = snapshotDiff(profile('BOND:UST2030; 2; 950; 4'), profile('BOND:UST2030; 2; 950; 5'));
  assert.equal(d.changes.length, 1);
  assert.equal(d.changes[0].oldValue, d.changes[0].newValue);
  assert.equal(d.changes[0].oldDuration, 4);
  assert.equal(d.changes[0].newDuration, 5);
  assert.ok(d.metrics.some(m => m[0] === 'Дюрация облигаций, лет' && m[1] === '4.00' && m[2] === '5.00'));
  assert.match(html, /мод\. дюрация '\+fmt\(c\.oldDuration\)/, 'UI must show duration changes');
});

test('ordinary equities do not receive invented bond duration', () => {
  const d = snapshotDiff(profile('AAPL; 10; 100'), profile('AAPL; 10; 110'));
  assert.equal(d.changes.length, 1);
  assert.equal(d.changes[0].oldDuration, null);
  assert.equal(d.changes[0].newDuration, null);
});

test('added and removed holdings appear even with identical total value', () => {
  const d = snapshotDiff(profile('AAPL; 10; 100'), profile('MSFT; 5; 200'));
  assert.equal(d.changes.length, 2);
  assert.deepEqual([...d.changes.map(x => x.name)].sort(), ['AAPL', 'MSFT']);
});

test('unchanged portfolio produces no instrument changes', () => {
  const d = snapshotDiff(profile('AAPL; 10; 100\nBOND:UST2030; 2; 950; 4'), profile('AAPL; 10; 100\nBOND:UST2030; 2; 950; 4'));
  assert.equal(d.changes.length, 0);
});

test('invalid holdings are rejected instead of silently mispriced', () => {
  for (const holdings of ['AAPL; 0; 100', 'AAPL; 1; -1', 'AAPL; NaN; 10', 'AAPL; 1; 100\naapl; 2; 100', 'BOND:UST2030; 1; 950; -2']) {
    assert.throws(() => parseHoldings(holdings));
  }
});

test('production inline Workspace JavaScript parses', () => {
  const script = html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script, 'Workspace inline script is required');
  assert.doesNotThrow(() => new Function(script));
});
