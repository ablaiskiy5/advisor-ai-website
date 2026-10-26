import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// Check the actual validator used by the live public MCP smoke test.
const source = readFileSync(new URL('../scripts/smoke-shared-mcp.mjs', import.meta.url), 'utf8');
const start = source.indexOf('function assert(');
const end = source.indexOf('async function run(){');
assert.ok(start >= 0 && end > start, 'Live MCP numeric validator must exist');
const { equalNumber } = runInNewContext(source.slice(start, end) + '\n({equalNumber})');

test('live MCP smoke accepts accurate finite numeric results', () => {
  assert.doesNotThrow(() => equalNumber(6.315789473684211, 60 / 950 * 100, 'Bond current yield'));
  assert.doesNotThrow(() => equalNumber(0.580000001, 0.58, 'HHI'));
  assert.doesNotThrow(() => equalNumber(-1.5, -1.5, 'Duration shock'));
});

test('live MCP smoke rejects coercible non-number results', () => {
  for (const value of ['6.315789473684211', null, true, false, '0.58']) {
    assert.throws(() => equalNumber(value, Number(value), 'MCP numeric type'), /FAIL: MCP numeric type/);
  }
});

test('live MCP smoke rejects nonfinite actual and expected values', () => {
  for (const value of [NaN, Infinity, -Infinity]) {
    assert.throws(() => equalNumber(value, 0, 'MCP nonfinite result'), /FAIL: MCP nonfinite result/);
    assert.throws(() => equalNumber(0, value, 'MCP nonfinite reference'), /FAIL: MCP nonfinite reference/);
  }
});

test('live MCP smoke still rejects inaccurate finite results', () => {
  assert.throws(() => equalNumber(0.6, 0.58, 'Incorrect HHI'), /FAIL: Incorrect HHI/);
});
