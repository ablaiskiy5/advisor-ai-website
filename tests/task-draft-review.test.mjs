import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

// Synthetic-only regression: no Supabase session, API call, or real task is used.
const html = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../tasks-board.html'), 'utf8');
const script = html.match(/<script>\s*([\s\S]*?)<\/script>\s*<\/body>/)?.[1];
assert.ok(script, 'Task board inline script must exist');
const offlineScript = script.replace(/^init\(\)\.catch\(e=>feedback\('Ошибка: '\+e\.message\)\);\s*$/m, '');
assert.notEqual(offlineScript, script, 'Disable the production initializer');

function harness() {
  const elements = {
    drafts: { children: [], set textContent(_) { this.children = []; }, append(child) { this.children.push(child); } },
    review: { classList: { remove() {}, add() {} } },
    'review-note': { textContent: '' },
    'save-drafts': { disabled: false },
    brain: { value: 'synthetic text' },
    info: { textContent: '' }
  };
  const document = {
    getElementById(id) { assert.ok(elements[id], 'Unknown element ' + id); return elements[id]; },
    createElement() { return { dataset: {}, innerHTML: '' }; }
  };
  const inserts = [];
  const mockDB = { from(table) {
    assert.equal(table, 'advisor_tasks');
    return { async insert(rows) { inserts.push(rows); return { error: null }; } };
  } };
  const api = runInNewContext(
    offlineScript + '\ndb=mockDB;user={id:"synthetic-owner"};load=async()=>{};({review,saveDrafts})',
    { document, mockDB, Date, Intl, TextEncoder }
  );
  return { elements, inserts, ...api };
}

function draftRow(fields = {}) {
  const values = {
    include: { checked: true },
    title: { value: 'Сверить расчёты' },
    due_date: { value: '2026-10-28' },
    area: { value: 'work' },
    priority: { value: 'high' },
    description: { value: 'Изменённые пользователем детали' },
    ...fields
  };
  return {
    dataset: { index: '0' },
    querySelector(selector) {
      const key = selector.match(/data-field="([^"]+)"/)?.[1];
      assert.ok(values[key], 'Missing draft input ' + key);
      return values[key];
    }
  };
}

test('AI-proposed details are visible, editable and HTML-escaped before approval', () => {
  const { review, elements } = harness();
  review([{ title: '<img src=x>', area: 'work', priority: 'normal',
    due_date: '2026-10-28', description: '</textarea><img src=x onerror=alert(1)>' }]);
  const markup = elements.drafts.children[0].innerHTML;
  assert.match(markup, /<textarea data-field="description" maxlength="3000"/);
  assert.match(markup, /&lt;\/textarea&gt;&lt;img/);
  assert.doesNotMatch(markup, /<\/textarea><img/);
  assert.match(markup, /&lt;img src=x&gt;/);
});

test('saving a reviewed task uses edited details, not hidden AI-proposed details', async () => {
  const { review, saveDrafts, elements, inserts } = harness();
  review([{ title: 'Сверить расчёты', description: 'Старая версия AI' }]);
  elements.drafts.children = [draftRow()];
  await saveDrafts();
  assert.equal(inserts.length, 1);
  assert.equal(inserts[0].length, 1);
  assert.equal(inserts[0][0].user_id, 'synthetic-owner');
  assert.equal(inserts[0][0].description, 'Изменённые пользователем детали');
});

test('overlong edited details are rejected before database insertion', async () => {
  const { saveDrafts, elements, inserts } = harness();
  elements.drafts.children = [draftRow({ description: { value: 'x'.repeat(3001) } })];
  await saveDrafts();
  assert.equal(inserts.length, 0);
  assert.match(elements.info.textContent, /Проверь название, дату и детали/);
});
