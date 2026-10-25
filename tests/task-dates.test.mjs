import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const html = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../tasks-board.html'), 'utf8');
const names = ['validDate', 'addCalendarDays', 'almatyToday', 'postponeDueDate'];
const lines = html.split('\n').filter(line => names.some(name => line.startsWith(`function ${name}(`)));
assert.equal(lines.length, 4, 'Date helpers must be present in tasks-board.html');
const { validDate, addCalendarDays, almatyToday, postponeDueDate } = runInNewContext(
  lines.join('\n') + '\n({validDate,addCalendarDays,almatyToday,postponeDueDate})', { Date, Intl }
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


test('postpone overdue and undated tasks to tomorrow, future tasks by one day', () => {
  const today = '2026-10-25';
  assert.equal(postponeDueDate('2026-10-01', today), '2026-10-26');
  assert.equal(postponeDueDate('2026-10-25', today), '2026-10-26');
  assert.equal(postponeDueDate(null, today), '2026-10-26');
  assert.equal(postponeDueDate('2026-10-28', today), '2026-10-29');
  assert.equal(postponeDueDate('2026-12-31', '2026-12-30'), '2027-01-01');
  assert.match(html, /due_date:postponeDueDate\(row\.due_date\)/);
  assert.match(html, /'На завтра'/);
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

test('narrow task board keeps action buttons usable and feedback accessible', () => {
  assert.match(html, /@media\(max-width:480px\)\{\.sectionhead\{flex-wrap:wrap\}/);
  assert.match(html, /\.sectionhead \.tools\{width:100%;justify-content:flex-start\}/);
  assert.match(html, /\.task \.actions \.btn,\.scopebar \.btn,\.tools \.btn\{min-height:44px\}/);
  assert.match(html, /\.btn:focus-visible\{outline:3px solid #b7d0ff;outline-offset:2px\}/);
  for (const id of ['info', 'review-note', 'edit-note']) {
    assert.match(html, new RegExp('id="' + id + '"[^>]*role="status" aria-live="polite"'));
  }
});

test('inline task-board JavaScript parses', () => {
  const inlineScript = html.match(/<script>\s*([\s\S]*?)<\/script>\s*<\/body>/)?.[1];
  assert.ok(inlineScript, 'Inline task-board script must exist');
  assert.doesNotThrow(() => new Function(inlineScript));
});

// Exercise the actual export helpers from the browser script, without running init()
// or accessing Supabase. Keep private tasks and credentials out of CI fixtures.
const browserScript = html.match(/<script>\s*([\s\S]*?)<\/script>\s*<\/body>/)?.[1];
assert.ok(browserScript, 'Task-board inline script must exist');
const offlineScript = browserScript.replace(/^init\(\)\.catch\(e=>feedback\('Ошибка: '\+e\.message\)\);\s*$/m, '');
assert.notEqual(offlineScript, browserScript, 'Disable the browser initializer for offline tests');
const { csvSafe, tasksCsv, icsEsc, icsFold, tasksIcs } = runInNewContext(
  offlineScript + '\n({csvSafe,tasksCsv,icsEsc,icsFold,tasksIcs})',
  { Date, Intl, TextEncoder }
);

test('CSV export escapes formulas, commas, quotes and NULs', () => {
  for (const value of ['=1+1', '+2+3', '-1+2', '@SUM(A1)', ' \t=1+1', '\r=1+1']) {
    assert.equal(csvSafe(value), '"\'' + value + '"', 'Dangerous CSV prefix: ' + JSON.stringify(value));
  }
  // Invisible format characters must not bypass formula-text escaping.
  for (const value of ['\u200B=1+1', '\u200C+2', '\u200D@SUM(A1)', '\u2060-1+2', '\u200B\u2060 =1+1']) {
    assert.equal(csvSafe(value), '"' + "'" + value + '"', 'Invisible formula prefix: ' + JSON.stringify(value));
  }
  assert.equal(csvSafe('\u200BОбычная задача'), '"\u200BОбычная задача"');
  assert.equal(csvSafe('Нормально, "да"'), '"Нормально, ""да"""');
  assert.equal(csvSafe('a\u0000b'), '"ab"');
  const csv = tasksCsv([{ title: '=2+2', area: 'work', priority: 'high', status: 'todo',
    due_date: '2026-10-24', description: 'Проверка, "кавычки"', created_at: '2026-10-24T00:00:00Z' }]);
  assert.ok(csv.startsWith('\uFEFF'), 'Excel-compatible UTF-8 BOM must be retained');
  assert.ok(csv.includes('"\'=2+2"'), 'Formula must be stored as text');
  assert.ok(csv.includes('"Проверка, ""кавычки"""'), 'Quotes and comma must remain in one cell');
  assert.ok(csv.endsWith('\r\n'), 'CSV must use CRLF line endings');
});

test('iCalendar escaping preserves user text without creating properties', () => {
  assert.equal(icsEsc('A\\B;C,D\r\nE'), 'A\\\\B\\;C\\,D\\nE');
});

test('iCalendar line folding respects the 75-octet UTF-8 limit', () => {
  const original = 'SUMMARY:' + 'К📈'.repeat(80);
  const folded = icsFold(original);
  assert.equal(folded.replace(/\r\n /g, ''), original, 'Unfolding must recover original Unicode text');
  for (const line of folded.split('\r\n')) {
    assert.ok(Buffer.byteLength(line, 'utf8') <= 75, 'Physical line exceeds 75 octets');
  }
});

test('iCalendar exports only active dated tasks as private all-day events', () => {
  const active = { id: 'synthetic-1', title: 'Проверить, отчёт; Q4\\финал', area: 'work',
    priority: 'high', status: 'todo', due_date: '2026-12-31', description: 'Строка 1\nСтрока 2' };
  const done = { ...active, id: 'synthetic-2', status: 'done' };
  const invalid = { ...active, id: 'synthetic-3', due_date: '2026-02-29' };
  const undated = { ...active, id: 'synthetic-4', due_date: null };
  const ics = tasksIcs([active, done, invalid, undated], new Date('2026-10-24T01:02:03Z'));
  const unfolded = ics.replace(/\r\n /g, '');
  assert.equal((unfolded.match(/BEGIN:VEVENT/g) || []).length, 1);
  assert.ok(unfolded.includes('DTSTAMP:20261024T010203Z'));
  assert.ok(unfolded.includes('DTSTART;VALUE=DATE:20261231\r\nDTEND;VALUE=DATE:20270101'));
  assert.ok(unfolded.includes('SUMMARY:Проверить\\, отчёт\\; Q4\\\\финал'));
  assert.ok(unfolded.includes('Строка 1\\nСтрока 2'));
  assert.ok(unfolded.includes('CLASS:PRIVATE'));
  assert.ok(!unfolded.includes('BEGIN:VALARM'), 'Import must not schedule reminders');
  assert.ok(ics.endsWith('\r\n'));
});

test('task CSV and calendar export filenames follow Almaty date, not UTC date', () => {
  // At 20:30 UTC on 24 Oct it is already 25 Oct in Almaty.
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : ['2026-10-24T20:30:00Z'])); }
    static now() { return Date.parse('2026-10-24T20:30:00Z'); }
  }
  const info = { textContent: '' };
  const app = runInNewContext(offlineScript + `
    let capturedNames = [];
    downloadExport = name => capturedNames.push(name);
    user = { id: 'synthetic-owner' };
    taskListComplete = true;
    items = [{ id: 'synthetic-task', title: 'Synthetic', status: 'todo',
      area: 'work', priority: 'normal', due_date: '2026-10-25', description: '' }];
    ({ exportCsv, exportCalendar, capturedNames });
  `, {
    Date: FixedDate, Intl, TextEncoder,
    document: { getElementById: () => info }
  });
  app.exportCsv();
  app.exportCalendar();
  assert.deepEqual(Array.from(app.capturedNames), [
    'AdvisorAI-tasks-2026-10-25.csv',
    'AdvisorAI-calendar-2026-10-25.ics'
  ]);
});
