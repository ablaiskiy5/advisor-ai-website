import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Execute production portfolio parser and CSV importer with synthetic holdings only.
const html = readFileSync(new URL('../workspace.html', import.meta.url), 'utf8');
function sourceBetween(start, end) {
  const a = html.indexOf(start), b = html.indexOf(end, a);
  assert.ok(a >= 0 && b > a, 'Missing production source: ' + start);
  return html.slice(a, b);
}
const { parseHoldings, normalizeHoldingsFile } = new Function(
  sourceBetween('function parseHoldings(text){', 'function savedHoldings(notes)') +
  sourceBetween('function splitCsvLine(line,delimiter){', 'function downloadHoldingsTemplate()') +
  '\nreturn { parseHoldings, normalizeHoldingsFile };'
)();

test('missing portfolio price cannot silently become a zero-valued holding', () => {
  assert.throws(() => parseHoldings('AAPL; 10; '), /цена не указана/);
  assert.throws(() => parseHoldings('BOND:UST2030; 2; ; 4'), /цена не указана/);
  assert.throws(() => normalizeHoldingsFile('Ticker,Quantity,Price\nAAPL,10,'), /цена не указана/);
});

test('explicit zero remains distinct from missing price', () => {
  const portfolio = parseHoldings('AAPL; 10; 0\nMSFT; 5; 100');
  assert.equal(portfolio.total, 500);
  assert.equal(portfolio.rows.find(r => r.ticker === 'AAPL').price, 0);
});

test('valid portfolio valuation, concentration and bond duration stay unchanged', () => {
  const portfolio = parseHoldings('AAPL; 2; 100\nBOND:UST2030; 1; 300; 4');
  assert.equal(portfolio.total, 500);
  assert.equal(portfolio.bondValue, 300);
  assert.equal(portfolio.equityValue, 200);
  assert.ok(Math.abs(portfolio.hhi - 0.52) < 1e-12);
  assert.equal(portfolio.bondDuration, 4);
  assert.ok(Math.abs(portfolio.rateShock100bp + 0.024) < 1e-12);
});
