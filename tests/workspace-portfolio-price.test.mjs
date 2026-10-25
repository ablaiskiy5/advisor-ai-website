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

test('headered CSV rejects missing or extra fields instead of silently dropping data', () => {
  assert.throws(() => normalizeHoldingsFile('Ticker,Quantity,Price,Type\nAAPL,10,100,Stock,EXTRA'), /Строка 2: количество столбцов/);
  assert.throws(() => normalizeHoldingsFile('Ticker,Quantity,Price,Type\nAAPL,10,100'), /Строка 2: количество столбцов/);
  assert.equal(normalizeHoldingsFile('Ticker,Quantity,Price,Type,Notes\nAAPL,10,100,Stock,"review, ok"'), 'AAPL; 10; 100');
  assert.equal(normalizeHoldingsFile('Ticker;Quantity;Price;Type\nAAPL;10;100;Stock'), 'AAPL; 10; 100');
});

test('headered CSV rejects duplicate mapped columns instead of choosing the first value', () => {
  for (const [csv, field] of [
    ['Ticker,Quantity,Price,Price\nAAPL,10,100,101', 'цена'],
    ['Ticker,Qty,Quantity,Price\nAAPL,10,11,100', 'количество'],
    ['Ticker,Quantity,Price,Type,AssetType\nAAPL,10,100,Stock,Stock', 'тип'],
    ['Ticker,Quantity,Price,Duration,Modified Duration\nBOND:UST,2,950,4,5', 'дюрация']
  ]) {
    assert.throws(() => normalizeHoldingsFile(csv), new RegExp('Повторяющиеся столбцы CSV: ' + field));
  }
  assert.equal(normalizeHoldingsFile('Ticker,Quantity,Price,Type,Notes\nAAPL,10,100,Stock,"review, ok"'), 'AAPL; 10; 100');
});
