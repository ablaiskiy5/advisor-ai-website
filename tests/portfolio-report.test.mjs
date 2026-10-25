import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// Exercise the production report functions, not rewritten copies of the formulas.
const html = readFileSync(new URL('../portfolio-report.html', import.meta.url), 'utf8');
function sourceBetween(start, end) {
  const a = html.indexOf(start);
  const b = html.indexOf(end, a);
  assert.ok(a >= 0 && b > a, 'Missing production source: ' + start);
  return html.slice(a, b);
}
const { parseSaved, rateShockScenario, combinedPortfolioStress, projectAllocation, customPortfolioStress } = runInNewContext(
  sourceBetween('const PORT_START=', 'let exportedRows=') +
  sourceBetween('function parseSaved(', 'function renderRateStress(') +
  sourceBetween('function combinedPortfolioStress(', 'function renderCombinedStress(') +
  sourceBetween('function projectAllocation(', 'function renderComparison(') +
  sourceBetween('function customPortfolioStress(', 'function renderCustomPortfolioStress(') +
  '\n({parseSaved,rateShockScenario,combinedPortfolioStress,projectAllocation,customPortfolioStress})'
);
const near = (actual, expected) =>
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) < 1e-9, actual + ' != ' + expected);
function saved(lines, target = null) {
  return [
    '[ADVISOR_AI_PORTFOLIO_BEGIN]',
    'КРАТКАЯ СВОДКА ДЛЯ AI:',
    ...(target === null ? [] : ['Целевая доля облигаций ' + target + '%.']),
    'Список позиций (тикер; количество; цена в USD):',
    ...lines,
    'Итого: пользовательский расчёт USD',
    '[ADVISOR_AI_PORTFOLIO_END]'
  ].join('\n');
}
const mixed = () => parseSaved(saved([
  'AAPL; 10; 100',
  'BOND:UST2030; 2; 950; 4',
  'MSFT; 5; 200'
], 40));

test('saved portfolio: valuation, class split, HHI and weighted duration', () => {
  const p = mixed();
  near(p.total, 3900);
  near(p.bondValue, 1900);
  near(p.equityValue, 2000);
  near(p.duration, 4);
  near(p.hhi, (1900 / 3900) ** 2 + 2 * (1000 / 3900) ** 2);
  near(p.top1, 1900 / 3900);
  near(p.top3, 1);
  assert.equal(p.target, 40);
  assert.equal(p.rows[0].name, 'BOND:UST2030');
});

test('100bp up/down shocks have the correct sign and USD/percent units', () => {
  const p = mixed();
  const up = rateShockScenario(p, 100);
  const down = rateShockScenario(p, -100);
  near(up.changeUsd, -76);
  near(up.portfolioPct, -76 / 3900 * 100);
  near(up.bondPct, -4);
  near(down.changeUsd, 76);
  near(down.portfolioPct, 76 / 3900 * 100);
  near(down.bondPct, 4);
  near(rateShockScenario(p, 0).changeUsd, 0);
});

test('large but finite bond portfolios retain finite duration and stress results', () => {
  // A naive value * duration * basisPoints overflows before division by 10000.
  const p = parseSaved(saved(['BOND:LONG; 1e307; 1; 80', 'AAPL; 1e307; 1'], 50));
  assert.equal(p.duration, 80);
  assert.ok(Number.isFinite(p.total));
  const rate = rateShockScenario(p, 100);
  assert.ok(Number.isFinite(rate.changeUsd));
  assert.ok(Math.abs(rate.changeUsd / -8e306 - 1) < 1e-12);
  near(rate.portfolioPct, -40);

  const combined = combinedPortfolioStress(p, 100, 100);
  assert.ok(Number.isFinite(combined.equityChangeUsd));
  assert.ok(Number.isFinite(combined.bondChangeUsd));
  assert.ok(Math.abs(combined.equityChangeUsd / 1e307 - 1) < 1e-12);
  assert.ok(Math.abs(combined.bondChangeUsd / -8e306 - 1) < 1e-12);
  near(combined.portfolioPct, 10);

  const allocation = projectAllocation(p, 50);
  assert.equal(allocation.possible, true);
  near(allocation.targetRateShock, -0.4);
  const custom = customPortfolioStress(p, 100, 100);
  assert.ok(Number.isFinite(custom.after.bondChangeUsd));
  assert.ok(Math.abs(custom.after.bondChangeUsd / -8e306 - 1) < 1e-12);
});

test('target allocation preserves total value and proportions within asset classes', () => {
  const p = mixed();
  const a = projectAllocation(p, 40);
  assert.equal(a.possible, true);
  near(a.rows.reduce((sum, r) => sum + r.projectedValue, 0), 3900);
  near(a.rows.filter(r => r.bond).reduce((sum, r) => sum + r.projectedValue, 0), 1560);
  near(a.rows.filter(r => !r.bond).reduce((sum, r) => sum + r.projectedValue, 0), 2340);
  near(a.rows.find(r => r.name === 'AAPL').projectedValue, 1170);
  near(a.rows.find(r => r.name === 'MSFT').projectedValue, 1170);
  near(a.hhi, 0.34);
  near(a.top1, 0.4);
  near(a.targetRateShock, -0.016); // fraction of entire portfolio for +100bp
});

test('reallocation cannot fabricate an absent asset class', () => {
  const p = parseSaved(saved(['AAPL; 10; 100']));
  assert.equal(projectAllocation(p, 40).possible, false);
  assert.equal(projectAllocation(p, 0).possible, true);
  assert.equal(projectAllocation(p, 100).possible, false);
  assert.equal(projectAllocation(p, -1).possible, false);
  assert.equal(projectAllocation(p, 101).possible, false);
});

test('invalid and duplicated holdings are rejected before producing a report', () => {
  assert.throws(() => parseSaved(saved(['AAPL; 1; 100', 'aapl; 2; 100'])), /Повторяющийся/);
  assert.throws(() => parseSaved(saved(['AAPL; -1; 100'])), /Некорректные/);
  assert.throws(() => parseSaved(saved(['AAPL; 1; '])), /цена не указана/);
  assert.throws(() => parseSaved(saved(['BOND:UST; 1; ; 4'])), /цена не указана/);
  assert.throws(() => parseSaved(saved(['BOND:UST; 1; 950; 101'])), /Некорректные/);
  assert.throws(() => parseSaved(saved(['AAPL; 1; 0'])), /Неверная общая стоимость/);
  assert.throws(() => parseSaved(saved(['AAPL; 1e308; 1e308'])), /Неверная общая стоимость/);
  assert.throws(() => parseSaved(saved(['AAPL; 1; 100'], 101)), /Целевая доля/);
});

test('invalid stress inputs fail rather than returning NaN or invented risk', () => {
  const p = mixed();
  assert.throws(() => rateShockScenario(p, Number.NaN), /Некорректные/);
  assert.throws(() => rateShockScenario({ ...p, total: 0 }, 100), /Некорректные/);
  assert.throws(() => rateShockScenario({ ...p, duration: -1 }, 100), /Некорректные/);
});

test('report requires an authenticated user and owner-scoped portfolio lookup', () => {
  // Regression guard for frontend checks; actual authorization is enforced by Supabase RLS.
  assert.match(html, /await db\.auth\.getUser\(\)/);
  assert.match(html, /\.eq\('user_id',user\.id\)/);
  assert.match(html, /data\.kind!=='portfolio'/);
});

test('report discloses that prices are user-entered rather than live quotes', () => {
  assert.match(html, /Никаких онлайн-котировок/);
  assert.match(html, /Все суммы рассчитаны на основе пользовательских цен/);
});
