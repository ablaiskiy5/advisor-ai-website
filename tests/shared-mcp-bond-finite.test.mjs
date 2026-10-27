import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Exercise the checked-in public MCP calculator, without Deno or client data.
const source = readFileSync(new URL('../supabase/functions/advisor-ai-shared-tools/index.ts', import.meta.url), 'utf8');
new vm.Script(source, { filename: 'advisor-ai-shared-tools/index.ts' });
const start = source.indexOf('const tools=');
const end = source.indexOf('const headers=');
assert.ok(start >= 0 && end > start, 'Calculator source must be extractable');
const { calculate } = vm.runInNewContext(source.slice(start, end) + '\n({calculate})');

test('bond current yield remains accurate for ordinary and very large finite inputs', () => {
  const regular = calculate('bond_current_yield', { face: 1000, coupon_percent: 6, price: 950 });
  assert.ok(Math.abs(regular.current_yield_percent - 60 / 950 * 100) < 1e-10);
  const large = calculate('bond_current_yield', { face: 1e308, coupon_percent: 100, price: 1e308 });
  assert.equal(large.annual_coupon_usd, 1e308);
  assert.equal(large.current_yield_percent, 100);
  assert.equal(calculate('bond_current_yield', { face: 1000, coupon_percent: 0, price: 1e-300 }).current_yield_percent, 0);
});

test('bond current yield rejects overflow instead of serializing Infinity as null', () => {
  assert.throws(() => calculate('bond_current_yield', {
    face: 1e308, coupon_percent: 100, price: 1e-300
  }), /Invalid bond yield result/);
});

test('duration shock remains accurate for ordinary and large finite inputs', () => {
  const regular = calculate('bond_duration_shock', {
    portfolio_usd: 1_000_000, bond_usd: 300_000, modified_duration: 5, yield_change_bp: 100
  });
  assert.equal(regular.change_usd, -15_000);
  assert.equal(regular.portfolio_change_percent, -1.5);
  const large = calculate('bond_duration_shock', {
    portfolio_usd: 1e308, bond_usd: 1e308, modified_duration: 100, yield_change_bp: 100
  });
  assert.equal(large.change_usd, -1e308);
  assert.equal(large.portfolio_change_percent, -100);
});

test('duration shock rejects overflow instead of serializing Infinity as null', () => {
  assert.throws(() => calculate('bond_duration_shock', {
    portfolio_usd: 1e308, bond_usd: 1e308, modified_duration: 100, yield_change_bp: 10_000
  }), /Invalid duration result/);
});
