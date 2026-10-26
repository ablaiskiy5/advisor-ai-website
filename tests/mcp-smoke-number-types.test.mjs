import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// Check the actual validator used by the live public MCP smoke test.
const source = readFileSync(new URL('../scripts/smoke-shared-mcp.mjs', import.meta.url), 'utf8');
const start = source.indexOf('function assert(');
const end = source.indexOf('async function run(){');
assert.ok(start >= 0 && end > start, 'Live MCP numeric validator must exist');
const { equalNumber, equalBoolean } = runInNewContext(source.slice(start, end) + '\n({equalNumber,equalBoolean})');

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


test('live MCP budget flags must be actual booleans, not coercible values', () => {
  assert.doesNotThrow(() => equalBoolean(true, true, 'Within pool'));
  assert.doesNotThrow(() => equalBoolean(false, false, 'Exceeded pool'));
  for (const value of ['true', 'false', 0, 1, null, undefined, [], {}]) {
    assert.throws(() => equalBoolean(value, true, 'Within pool'), /FAIL: Within pool/);
    assert.throws(() => equalBoolean(value, false, 'Exceeded pool'), /FAIL: Exceeded pool/);
  }
  assert.throws(() => equalBoolean(false, true, 'Wrong flag'), /FAIL: Wrong flag/);
  assert.throws(() => equalBoolean(true, false, 'Wrong flag'), /FAIL: Wrong flag/);
});

test('live MCP smoke validates both budget flags strictly', () => {
  assert.match(source, /equalBoolean\(within\.within_pool,true,'Within-pool flag'\)/);
  assert.match(source, /equalBoolean\(over\.within_pool,false,'Exceeded-pool flag'\)/);
});
