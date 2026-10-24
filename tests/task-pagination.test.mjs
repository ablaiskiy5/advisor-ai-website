import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { TextEncoder } from 'node:util';

const html = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../tasks-board.html'), 'utf8');
const inline = html.match(/<script>\s*([\s\S]*?)<\/script>\s*<\/body>/)?.[1];
assert.ok(inline, 'Production task-board script must exist');
const offline = inline.replace(/^init\(\)\.catch\(e=>feedback\('Ошибка: '\+e\.message\)\);\s*$/m, '');
assert.notEqual(offline, inline, 'Disable real Supabase initializer');

function harness() {
  const info = { textContent: '' };
  const app = runInNewContext(offline + `
render=()=>{};
let exported=[];
downloadExport=(name,body,mime)=>exported.push({name,body,mime});
({load,exportCsv,exportCalendar,setup:(database,identity)=>{db=database;user=identity},
 snapshot:()=>({count:items.length,complete:taskListComplete,ids:items.map(x=>x.id)}),
 exports:()=>exported,resetExports:()=>{exported=[]}})
`, { Date, Intl, TextEncoder, document: { getElementById: () => info } });
  return { ...app, info };
}

function fakeDatabase(count, failAt = -1) {
  const rows = Array.from({ length: count }, (_, i) => ({
    id: 'synthetic-' + i, title: 'Synthetic task ' + i,
    area: 'work', priority: 'normal', status: 'todo', due_date: '2026-10-24',
    description: '', created_at: '2026-10-24T00:00:00Z'
  }));
  const pages = [];
  return {
    pages,
    from(table) {
      assert.equal(table, 'advisor_tasks');
      const ordered = [];
      return {
        select(columns) {
          assert.match(columns, /created_at/);
          return this;
        },
        eq(column, value) {
          assert.equal(column, 'user_id', 'Always scope pagination to the signed-in owner');
          assert.equal(value, 'synthetic-user');
          return this;
        },
        order(column, options) {
          assert.equal(options.ascending, false);
          ordered.push(column);
          return this;
        },
        async range(start, end) {
          assert.deepEqual(ordered, ['created_at', 'id'], 'Stable ordering prevents page-boundary duplicates');
          assert.equal(end - start + 1, 500);
          pages.push([start, end]);
          return start === failAt
            ? { data: null, error: { message: 'Synthetic network error' } }
            : { data: rows.slice(start, end + 1), error: null };
        }
      };
    }
  };
}

test('owner-scoped pagination retrieves every task, including exact 500-row boundaries', async () => {
  for (const [count, expectedPages] of [[0, 1], [499, 1], [500, 2], [501, 2], [1201, 3]]) {
    const app = harness(), db = fakeDatabase(count);
    app.setup(db, { id: 'synthetic-user' });
    await app.load();
    const snapshot = app.snapshot();
    assert.equal(snapshot.complete, true);
    assert.equal(snapshot.count, count);
    assert.equal(new Set(snapshot.ids).size, count, 'No duplicate tasks');
    assert.equal(db.pages.length, expectedPages);
    if (count) {
      assert.equal(snapshot.ids[0], 'synthetic-0');
      assert.equal(snapshot.ids[count - 1], 'synthetic-' + (count - 1));
    }
  }
});

test('CSV and calendar exports include tasks beyond the old 500-row cap', async () => {
  const app = harness();
  app.setup(fakeDatabase(501), { id: 'synthetic-user' });
  await app.load();
  app.exportCsv();
  app.exportCalendar();
  const exports = app.exports();
  assert.equal(exports.length, 2);
  assert.match(exports[0].body, /Synthetic task 500/);
  assert.equal((exports[1].body.match(/BEGIN:VEVENT/g) || []).length, 501);
  assert.match(app.info.textContent, /501 задач/);
});

test('partial page failure blocks both exports instead of silently omitting tasks', async () => {
  const app = harness();
  app.setup(fakeDatabase(501, 500), { id: 'synthetic-user' });
  await app.load();
  assert.equal(app.snapshot().complete, false);
  assert.match(app.info.textContent, /Ошибка загрузки/);
  app.exportCsv();
  app.exportCalendar();
  assert.equal(app.exports().length, 0);
});

test('defensive 10,000-task ceiling rejects partial exports', async () => {
  const app = harness(), db = fakeDatabase(10001);
  app.setup(db, { id: 'synthetic-user' });
  await app.load();
  assert.equal(app.snapshot().complete, false);
  assert.equal(db.pages.length, 21);
  app.exportCsv();
  assert.equal(app.exports().length, 0);
});
