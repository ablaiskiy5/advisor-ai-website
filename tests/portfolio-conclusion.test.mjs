import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// Exercises the real production conclusion generator and production portfolio parser.
const html = readFileSync(new URL('../portfolio-report.html', import.meta.url), 'utf8');
function between(start, end) {
 const a = html.indexOf(start), b = html.indexOf(end, a);
 assert.ok(a >= 0 && b > a, 'Production source missing: ' + start);
 return html.slice(a, b);
}
const code = [
 "const PORT_START='[ADVISOR_AI_PORTFOLIO_BEGIN]',PORT_END='[ADVISOR_AI_PORTFOLIO_END]';",
 "const cash=n=>n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}),pct=n=>(100*n).toFixed(1)+'%';",
 between('function parseSaved(', 'function renderRateStress('),
 between('function projectAllocation(', 'function customPortfolioStress('),
 between('function buildInvestmentConclusion(', 'function renderReport('),
 '({parseSaved,buildInvestmentConclusion})'
].join('\n');
const { parseSaved, buildInvestmentConclusion } = runInNewContext(code);

function input(rows, target = null) {
 return [
  '[ADVISOR_AI_PORTFOLIO_BEGIN]',
  'Список позиций (тикер; количество; цена в USD):',
  ...rows,
  'Итого: пользовательский расчёт USD',
  ...(target === null ? [] : ['Целевая доля облигаций ' + target + '%.']),
  '[ADVISOR_AI_PORTFOLIO_END]'
 ].join('\n');
}

test('investment conclusion includes actual weights, values, duration and proposed shift', () => {
 const portfolio = parseSaved(input(['NVDA; 7000; 100', 'BOND:UST10; 3000; 100; 5'], 40));
 const memo = buildInvestmentConclusion(portfolio);
 assert.match(memo, /1,000,000\.00 USD/);
 assert.match(memo, /Акции: 70\.0%\. Облигации: 30\.0%/);
 assert.match(memo, /NVDA \(70\.0%\)/);
 assert.match(memo, /HHI: 0\.5800/);
 assert.match(memo, /-15,000\.00 USD/);
 assert.match(memo, /-140,000\.00 USD/);
 assert.match(memo, /увеличить долговой сегмент на 100,000\.00 USD/);
 assert.match(memo, /не подбирает новые бумаги/);
 assert.match(memo, /не содержит онлайн-котировок/);
});

test('no target is not invented and zero bond allocation is explicit', () => {
 const portfolio = parseSaved(input(['AAPL; 2; 100', 'MSFT; 3; 100']));
 const memo = buildInvestmentConclusion(portfolio);
 assert.match(memo, /Целевая доля облигаций не задана/);
 assert.match(memo, /Облигации отсутствуют/);
 assert.doesNotMatch(memo, /Арифметически увеличить|Арифметически уменьшить/);
});

test('rebalance cannot fabricate missing bonds', () => {
 const portfolio = parseSaved(input(['NVDA; 10; 100'], 40));
 const memo = buildInvestmentConclusion(portfolio);
 assert.match(memo, /Состав целевого портфеля нельзя рассчитать/);
 assert.match(memo, /Невозможно оценить инструментную структуру/);
});

test('diversified report does not invent single-name concentration alerts', () => {
 const portfolio = parseSaved(input(['AAPL; 1; 100', 'MSFT; 1; 100', 'NVDA; 1; 100', 'AMZN; 1; 100'], 0));
 const memo = buildInvestmentConclusion(portfolio);
 assert.match(memo, /Крупнейшая позиция ниже порога 35%/);
 assert.doesNotMatch(memo, /Высокая концентрация/);
 assert.match(memo, /соответствует выбранной цели/);
});

test('invalid portfolio does not produce an investment conclusion', () => {
 assert.throws(() => buildInvestmentConclusion({total: 0, rows: []}), /корректный портфель/);
 assert.throws(() => parseSaved(input(['AAPL; 1; -100'])), /Некорректные/);
});

test('client data is rendered as text and copy/export require a user click', () => {
 assert.match(html, /\$\('r-conclusion'\)\.textContent=currentInvestmentConclusion/);
 assert.match(html, /id="copy-conclusion"[^>]*disabled/);
 assert.match(html, /id="download-conclusion"[^>]*disabled/);
 assert.match(html, /addEventListener\('click',async\(\)=>/);
 const script = html.match(/<script>([\s\S]*?)<\/script>/);
 assert.ok(script, 'Browser script must exist');
 assert.doesNotThrow(() => new Function(script[1]), 'Browser JavaScript must parse');
});

test('portfolio report explicitly distinguishes creation time from unverified valuation date', () => {
 const memo=buildInvestmentConclusion(parseSaved(input(['AAPL; 1; 100'])));
 assert.match(memo,/Дата оценки и источник котировок не подтверждены/);
 assert.match(html,/id="r-valuation-warning"[^>]*Дата оценки и источник котировок не подтверждены/);
 assert.match(html,/Отчёт сформирован:/);
 assert.match(html,/Дата оценки активов: не подтверждена/);
});
