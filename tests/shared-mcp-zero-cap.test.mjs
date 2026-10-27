import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Test the checked-in source of the public, stateless MCP calculator, without
// invoking Deno.serve or accessing Supabase, credentials, or client records.
const source = readFileSync(new URL('../supabase/functions/advisor-ai-shared-tools/index.ts', import.meta.url), 'utf8');
const start = source.indexOf('const tools=');
const end = source.indexOf('const headers=');
assert.ok(start >= 0 && end > start, 'Public calculator source is extractable');
const { calculate } = vm.runInNewContext(source.slice(start, end) + '\n({calculate})');

test('zero speculative allocation never accepts a positive position, however tiny', () => {
  const tiny = calculate('trade_risk_budget', {
    portfolio_usd: 1_000_000, pool_percent: 0,
    positions: [{name: 'TINY', amount_usd: 0.00000005}]
  });
  assert.equal(tiny.budget_usd, 0);
  assert.equal(tiny.within_pool, false);
  assert.ok(tiny.remaining_usd < 0);
  const empty = calculate('trade_risk_budget', {
    portfolio_usd: 1_000_000, pool_percent: 0, positions: []
  });
  assert.equal(empty.within_pool, true);
});

test('positive pool tolerates binary floating point rounding but not real overspend', () => {
  const rounded = calculate('trade_risk_budget', {
    portfolio_usd: 1, pool_percent: 30,
    positions: [{name: 'A', amount_usd: 0.1}, {name: 'B', amount_usd: 0.2}]
  });
  assert.equal(rounded.within_pool, true);
  const over = calculate('trade_risk_budget', {
    portfolio_usd: 1, pool_percent: 30,
    positions: [{name: 'A', amount_usd: 0.1}, {name: 'B', amount_usd: 0.200001}]
  });
  assert.equal(over.within_pool, false);
});

test('ordinary ten-percent budget and other calculators preserve existing behavior', () => {
  const budget = calculate('trade_risk_budget', {
    portfolio_usd: 1_000_000, pool_percent: 10,
    positions: [{name: 'A', amount_usd: 60_000}, {name: 'B', amount_usd: 40_000}]
  });
  assert.equal(budget.budget_usd, 100_000);
  assert.equal(budget.within_pool, true);
  assert.equal(budget.remaining_usd, 0);
  assert.ok(Math.abs(calculate('bond_current_yield', {face:1000,coupon_percent:6,price:950}).current_yield_percent - 6.315789473684211) < 1e-10);
  assert.ok(Math.abs(calculate('portfolio_concentration', {holdings:[{ticker:'A',value:70},{ticker:'B',value:30}]}).hhi - 0.58) < 1e-10);
  assert.equal(calculate('bond_duration_shock', {portfolio_usd:1_000_000,bond_usd:300_000,modified_duration:5,yield_change_bp:100}).change_usd, -15_000);
});
