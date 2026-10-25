import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const html = readFileSync(new URL('../workspace.html', import.meta.url), 'utf8');
function sourceBetween(start, end) {
 const a = html.indexOf(start), b = html.indexOf(end, a);
 assert.ok(a >= 0 && b > a, 'Missing production CSV function');
 return html.slice(a, b);
}
const production = sourceBetween('function parseHoldings(', 'function savedHoldings(') +
 '\n' + sourceBetween('function splitCsvLine(', 'function downloadHoldingsTemplate(');
const { splitCsvLine, normalizeHoldingsFile } = runInNewContext(
 production + '\n({splitCsvLine,normalizeHoldingsFile})'
);

test('standard quoted broker CSV values and escaped quotes still import', () => {
 assert.deepEqual(Array.from(splitCsvLine('AAPL,2,"100",Stock,"Example, ""A"""', ',')),
  ['AAPL', '2', '100', 'Stock', 'Example, "A"']);
 assert.deepEqual(Array.from(splitCsvLine(' AAPL , 2 , "100"  , Stock', ',')),
  ['AAPL', '2', '100', 'Stock']);
 assert.equal(normalizeHoldingsFile(
  'Ticker,Quantity,Price,Type,Note\nAAPL,2,"100",Stock,"Example, ""A"""'
 ), 'AAPL; 2; 100');
});

test('malformed quote boundaries cannot silently change a price', () => {
 for (const row of ['AAPL,2,"10"0,Stock', 'AAPL,2,1"00,Stock',
  'AAPL,2,"100"x,Stock', 'AAPL,2,"100,Stock']) {
  assert.throws(() => normalizeHoldingsFile(
   'Ticker,Quantity,Price,Type\n' + row
  ), /кавычк|символ/);
 }
});

test('malformed quoted headers are rejected before portfolio calculation', () => {
 assert.throws(() => normalizeHoldingsFile(
  'Ticker,Quantity,Price,Type,"Note"suffix\nAAPL,2,100,Stock,ok'
 ), /кавычк|символ/);
});

test('production inline Workspace JavaScript still parses', () => {
 const inline = html.match(/<script>\s*([\s\S]*?)<\/script>\s*<\/body>/)?.[1];
 assert.ok(inline);
 assert.doesNotThrow(() => new Function(inline));
});
