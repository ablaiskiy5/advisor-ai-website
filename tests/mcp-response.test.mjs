import test from 'node:test';
import assert from 'node:assert/strict';
import { requireMcpResult } from '../scripts/mcp-response.mjs';

const valid = { jsonrpc: '2.0', id: 7, result: { tools: [] } };

test('public MCP smoke accepts a correctly correlated JSON-RPC result', () => {
  assert.deepEqual(requireMcpResult(valid, 7, 'tools/list'), { tools: [] });
  assert.equal(requireMcpResult({ jsonrpc: '2.0', id: 7, result: null }, 7, 'tools/list'), null);
});

test('public MCP smoke rejects mismatched request IDs', () => {
  assert.throws(() => requireMcpResult(valid, 8, 'tools/list'), /request ID/);
  assert.throws(() => requireMcpResult({ ...valid, id: '7' }, 7, 'tools/list'), /request ID/);
});

test('public MCP smoke rejects an incorrect JSON-RPC version', () => {
  assert.throws(() => requireMcpResult({ ...valid, jsonrpc: '1.0' }, 7, 'tools/list'), /JSON-RPC/);
});

test('public MCP smoke rejects missing result', () => {
  assert.throws(() => requireMcpResult({ jsonrpc: '2.0', id: 7 }, 7, 'tools/list'), /JSON-RPC/);
});

test('public MCP smoke rejects conflicting result and error', () => {
  assert.throws(() => requireMcpResult({ ...valid, error: null }, 7, 'tools/list'), /JSON-RPC/);
});

test('public MCP smoke rejects non-object response bodies', () => {
  for (const body of [null, [], 'ok', 0]) {
    assert.throws(() => requireMcpResult(body, 7, 'tools/list'), /JSON-RPC/);
  }
});
