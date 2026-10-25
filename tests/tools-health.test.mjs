import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../tools-health.html', import.meta.url), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, 'Browser diagnostic must contain an inline script');
const allowlist = ['bond_current_yield', 'portfolio_concentration', 'trade_risk_budget', 'bond_duration_shock'];

async function runBrowserCheck(toolNames, invalidSchema = false, responseOverride = {}) {
  const elements = new Map();
  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, { textContent: '', className: '', disabled: false });
      return elements.get(id);
    },
  };
  const fetch = async (_url, options) => {
    const request = JSON.parse(options.body);
    let result;
    if (request.method === 'initialize') {
      result = { serverInfo: { name: 'advisor-ai-shared-tools' } };
    } else if (request.method === 'tools/list') {
      result = { tools: toolNames.map((name, i) => ({
        name, description: 'Public deterministic calculator',
        inputSchema: invalidSchema && i === 0 ? {} : { type: 'object' },
      })) };
    } else if (request.method === 'tools/call') {
      switch (request.params.name) {
        case 'bond_current_yield':
          result = request.params.arguments.price === 0
            ? { isError: true, ...(responseOverride.invalidStructuredContent ? { structuredContent: { current_yield_percent: 0 } } : {}) }
            : { structuredContent: { current_yield_percent: 6.315789473684211 } };
          break;
        case 'trade_risk_budget':
          result = { structuredContent: { within_pool: false, remaining_usd: -100000 } };
          break;
        case 'portfolio_concentration':
          result = { structuredContent: { hhi: 0.58 } };
          break;
        case 'bond_duration_shock':
          result = { structuredContent: { portfolio_change_percent: -1.5 } };
          break;
        default:
          throw Error('Unexpected tool call: ' + request.params.name);
      }
    } else {
      throw Error('Unexpected MCP method: ' + request.method);
    }
    return { ok: true, status: 200, text: async () => JSON.stringify({
      jsonrpc: responseOverride.jsonrpc ?? '2.0',
      id: responseOverride.id ?? request.id,
      ...(responseOverride.missingResult ? {} : { result }),
      ...(responseOverride.errorField ? { error: null } : {}),
    }) };
  };
  vm.runInNewContext(script, { document, fetch, AbortController, setTimeout, clearTimeout });
  await elements.get('test').onclick();
  return {
    overall: elements.get('overall').textContent,
    list: elements.get('step-list').textContent,
    details: elements.get('details').textContent,
  };
}

test('browser MCP diagnostic passes for exactly four described public tools', async () => {
  const result = await runBrowserCheck(allowlist);
  assert.match(result.overall, /Все 7 проверок пройдены/);
  assert.match(result.list, /Ровно 4 публичных инструмента/);
});

test('browser MCP diagnostic fails if a private or unexpected tool appears', async () => {
  const result = await runBrowserCheck([...allowlist, 'private_case_list']);
  assert.match(result.overall, /Пройдено 6 из 7/);
  assert.match(result.list, /Ошибка/);
  assert.match(result.details, /требуется ровно 4/);
});

test('browser MCP diagnostic fails for duplicate or substituted tool names', async () => {
  const result = await runBrowserCheck([...allowlist.slice(0, 3), allowlist[0]]);
  assert.match(result.overall, /Пройдено 6 из 7/);
  assert.match(result.list, /Ошибка/);
});

test('browser MCP diagnostic fails for missing input schema', async () => {
  const result = await runBrowserCheck(allowlist, true);
  assert.match(result.overall, /Пройдено 6 из 7/);
  assert.match(result.details, /схема инструмента/);
});


test('browser MCP diagnostic rejects a response with a different request ID', async () => {
  const result = await runBrowserCheck(allowlist, false, { id: 999 });
  assert.match(result.overall, /Пройдено 0 из 7/);
  assert.match(result.details, /ID запроса/);
});

test('browser MCP diagnostic rejects an invalid JSON-RPC version', async () => {
  const result = await runBrowserCheck(allowlist, false, { jsonrpc: '1.0' });
  assert.match(result.overall, /Пройдено 0 из 7/);
  assert.match(result.details, /JSON-RPC/);
});

test('browser MCP diagnostic rejects responses missing the result field', async () => {
  const result = await runBrowserCheck(allowlist, false, { missingResult: true });
  assert.match(result.overall, /Пройдено 0 из 7/);
  assert.match(result.details, /JSON-RPC/);
});


test('browser MCP diagnostic rejects success envelopes with an error member, even null', async () => {
  const result = await runBrowserCheck(allowlist, false, { errorField: true });
  assert.match(result.overall, /Пройдено 0 из 7/);
  assert.match(result.details, /JSON-RPC/);
});

test('browser MCP diagnostic rejects invalid-input errors carrying structured data', async () => {
  const result = await runBrowserCheck(allowlist, false, { invalidStructuredContent: true });
  assert.match(result.overall, /Пройдено 6 из 7/);
  assert.match(result.details, /нулевой цене/);
});
