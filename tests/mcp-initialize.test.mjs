import test from 'node:test';
import assert from 'node:assert/strict';
import { requireMcpInitialize } from '../scripts/mcp-response.mjs';

const valid = {
  protocolVersion: '2025-06-18',
  capabilities: { tools: {} },
  serverInfo: { name: 'advisor-ai-shared-tools' },
};

test('live MCP smoke accepts the expected initialization contract', () => {
  assert.equal(requireMcpInitialize(valid), valid);
});

test('live MCP smoke rejects incompatible protocol and server identity', () => {
  assert.throws(() => requireMcpInitialize({ ...valid, protocolVersion: '2024-11-05' }), /incompatible protocol/);
  assert.throws(() => requireMcpInitialize({ ...valid, serverInfo: { name: 'other' } }), /incompatible protocol/);
});

test('live MCP smoke rejects missing or malformed tool capability', () => {
  for (const capabilities of [{}, { tools: null }, { tools: [] }, { tools: true }]) {
    assert.throws(() => requireMcpInitialize({ ...valid, capabilities }), /missing tools capability/);
  }
  assert.throws(() => requireMcpInitialize(null), /incompatible protocol/);
});
