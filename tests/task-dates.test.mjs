import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const html = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../tasks-board.html'), 'utf8');
const names = ['validDate', 'addCalendarDays', 'almatyToday'];
const lines = html.split('\n').filter(line => names.some(name => line.startsWith(`function ${name}(`)));
assert.equal(lines.length, 3, 'Date helpers must be present in tasks-board.html');
const { validDate, addCalendarDays, almatyToday } = runInNewContext(
  lines.join('\n') + '\n({validDate,addCalendarDays,almatyToday})', { Date, Intl }
);

test('date-only validation is timezone-independent', () => {
  assert.equal(validDate('2028-02-29'), true);
  assert.equal(validDate('2027-02-29'), false);
  assert.equal(validDate('2026-13-01'), false);
});

test('postpone and weekly filter cross month/year boundaries correctly', () => {
  assert.equal(addCalendarDays('2028-02-28', 1), '2028-02-29');
  assert.equal(addCalendarDays('2028-02-29', 1), '2028-03-01');
  assert.equal(addCalendarDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addCalendarDays('2026-12-28', 7), '2027-01-04');
});

test('Almaty day boundaries do not depend on browser timezone', () => {
  assert.equal(almatyToday(new Date('2026-10-23T18:59:59Z')), '2026-10-23');
  assert.equal(almatyToday(new Date('2026-10-23T19:00:00Z')), '2026-10-24');
  assert.equal(almatyToday(new Date('2026-12-31T19:00:00Z')), '2027-01-01');
});

test('seven-day scope includes today plus six days, not eight days', () => {
  assert.match(html, /const week=addCalendarDays\(today,6\);/);
  assert.match(html, /scope==='week'&&x\.status!=='done'&&x\.due_date&&x\.due_date<=week/);
  for (const [today, lastIncluded, firstExcluded] of [
    ['2026-10-24', '2026-10-30', '2026-10-31'],
    ['2026-12-29', '2027-01-04', '2027-01-05'],
    ['2028-02-27', '2028-03-04', '2028-03-05']
  ]) {
    const end = addCalendarDays(today, 6);
    assert.equal(end, lastIncluded);
    assert.ok(today <= end && lastIncluded <= end);
    assert.ok(firstExcluded > end);
  }
});

test('inline task-board JavaScript parses', () => {
  const inlineScript = html.match(/<script>\s*([\s\S]*?)<\/script>\s*<\/body>/)?.[1];
  assert.ok(inlineScript, 'Inline task-board script must exist');
  assert.doesNotThrow(() => new Function(inlineScript));
});
