import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Public MCP is deliberately stateless. Never expand it into a private-data API.
const source = readFileSync(new URL('../supabase/functions/advisor-ai-shared-tools/index.ts', import.meta.url), 'utf8');
const expected = ['bond_current_yield', 'bond_duration_shock', 'portfolio_concentration', 'trade_risk_budget'];
let handler;
vm.runInNewContext(source, {
  Deno: { serve(callback) { handler = callback; } },
  Response,
}, { filename: 'advisor-ai-shared-tools/index.ts' });
assert.equal(typeof handler, 'function', 'Production MCP must register a request handler');

let nextId = 0;
async function request(method, params = {}) {
  const id = ++nextId;
  const reply = await handler({
    method: 'POST',
    headers: { get: () => null },
    text: async () => JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  });
  assert.equal(reply.status, 200);
  const body = await reply.json();
  assert.equal(body.jsonrpc, '2.0');
  assert.equal(body.id, id);
  return body;
}

test('public MCP advertises exactly four stateless mathematical tools', async () => {
  const { result } = await request('tools/list');
  assert.equal(result.cacheScope, 'public');
  assert.equal(result.resultType, 'complete');
  assert.deepEqual(Array.from(result.tools, tool => tool.name).sort(), expected);
  for (const tool of result.tools) {
    assert.equal(tool.inputSchema.type, 'object', tool.name);
    assert.equal(tool.inputSchema.additionalProperties, false, tool.name);
    assert.ok(tool.description?.length > 10, tool.name);
  }
});

test('undeclared private operations cannot return structured content', async () => {
  for (const name of ['private_case_list', 'advisor_tasks_list', 'portfolio_snapshots_read']) {
    const { result } = await request('tools/call', { name, arguments: {} });
    assert.equal(result.isError, true, name);
    assert.equal(Object.hasOwn(result, 'structuredContent'), false, name);
  }
});

test('public MCP source cannot silently acquire credentials, data stores or outbound network access', () => {
  const prohibited = [
    /\bDeno\s*\.\s*env\b/,
    /\bprocess\s*\.\s*env\b/,
    /\bcreateClient\s*\(/,
    /\bfetch\s*\(/,
    /\bservice[_-]?role\b/i,
    /\b(?:advisor_tasks|portfolio_snapshots|advisor_ai_messages|advisor_ai_attachments|advisor_cases)\b/i,
  ];
  for (const pattern of prohibited) {
    assert.doesNotMatch(source, pattern, 'Public MCP must remain independent of private resources: ' + pattern);
  }
});
