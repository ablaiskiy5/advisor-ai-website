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
  const info = { textContent: '', value: '', classList: { add() {} } };
  const timers = [];
  const app = runInNewContext(offline + `
render=()=>{};
let exported=[];
downloadExport=(name,body,mime)=>exported.push({name,body,mime});
({load,change,exportCsv,exportCalendar,handleTaskAuthChange,setup:(database,identity)=>{db=database;user=identity},
 snapshot:()=>({count:items.length,complete:taskListComplete,userId:user?.id||null,ids:items.map(x=>x.id)}),
 exports:()=>exported,resetExports:()=>{exported=[]}})
`, { Date, Intl, TextEncoder, document: { getElementById: () => info }, setTimeout: fn => timers.push(fn) });
  return { ...app, info, runTimers: async () => { for (const fn of timers.splice(0)) await fn(); } };
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

test('sign-out immediately clears task data and disables exports', async () => {
  const app = harness();
  app.setup(fakeDatabase(2), { id: 'synthetic-user' });
  await app.load();
  assert.equal(app.snapshot().complete, true);
  app.info.value = 'Synthetic unsaved note';
  app.handleTaskAuthChange('SIGNED_OUT', null);
  assert.equal(app.snapshot().userId, null);
  assert.equal(app.snapshot().count, 0);
  assert.equal(app.snapshot().complete, false);
  assert.equal(app.info.value, '', 'Unsaved text from previous account must be cleared');
  app.exportCsv();
  app.exportCalendar();
  assert.equal(app.exports().length, 0);
});

test('stale paginated response cannot overwrite tasks after account switch', async () => {
  let releaseOldPage;
  const database = {
    from(table) {
      assert.equal(table, 'advisor_tasks');
      let owner;
      return {
        select() { return this; },
        eq(field, value) { assert.equal(field, 'user_id'); owner = value; return this; },
        order() { return this; },
        range() {
          if (owner === 'synthetic-user') return new Promise(resolve => { releaseOldPage = resolve; });
          assert.equal(owner, 'second-user');
          return Promise.resolve({ data: [{
            id: 'second-user-task', title: 'Second synthetic task',
            area: 'work', priority: 'normal', status: 'todo',
            due_date: '2026-10-24', description: '', created_at: '2026-10-24T00:00:00Z'
          }], error: null });
        }
      };
    }
  };
  const app = harness();
  app.setup(database, { id: 'synthetic-user' });
  const oldRequest = app.load();
  assert.equal(typeof releaseOldPage, 'function');
  app.handleTaskAuthChange('SIGNED_IN', { user: { id: 'second-user' } });
  await app.runTimers();
  releaseOldPage({ data: [{ id: 'old-owner-task', title: 'Old synthetic task' }], error: null });
  await oldRequest;
  assert.equal(app.snapshot().userId, 'second-user');
  assert.equal(app.snapshot().complete, true);
  assert.equal(app.snapshot().count, 1);
  assert.equal(app.snapshot().ids[0], 'second-user-task');
});

function deferredQuickActionDb() {
  const requests = [];
  let release;
  return {
    requests,
    from(table) {
      assert.equal(table, 'advisor_tasks');
      return {
        update(fields) { requests.push({ fields, filters: [] }); return this; },
        eq(field, value) {
          requests.at(-1).filters.push([field, value]);
          if (field === 'user_id') return new Promise(resolve => { release = resolve; });
          return this;
        }
      };
    },
    finish(result) {
      assert.equal(typeof release, 'function', 'Quick action must await the owner-scoped write');
      release(result);
    }
  };
}

test('quick action applies a successful write in the current owner session', async () => {
  const app = harness(), db = deferredQuickActionDb();
  const task = { id: 'synthetic-task', status: 'todo' };
  app.setup(db, { id: 'synthetic-user' });
  const pending = app.change(task, { status: 'done' });
  assert.deepEqual(db.requests[0].filters, [['id', 'synthetic-task'], ['user_id', 'synthetic-user']]);
  db.finish({ error: null });
  await pending;
  assert.equal(task.status, 'done');
});

test('late quick-action success cannot mutate old task after account switch', async () => {
  const app = harness(), db = deferredQuickActionDb();
  const task = { id: 'old-task', status: 'todo' };
  app.setup(db, { id: 'synthetic-user' });
  const pending = app.change(task, { status: 'done' });
  app.handleTaskAuthChange('SIGNED_IN', { user: { id: 'second-user' } });
  const message = app.info.textContent;
  db.finish({ error: null });
  await pending;
  assert.equal(task.status, 'todo', 'Old task object must remain unchanged');
  assert.equal(app.snapshot().userId, 'second-user');
  assert.equal(app.info.textContent, message, 'Old action must not update new session feedback');
});

test('late quick-action error is ignored after same-account sign-out and re-login', async () => {
  const app = harness(), db = deferredQuickActionDb();
  const task = { id: 'old-task', status: 'todo' };
  app.setup(db, { id: 'synthetic-user' });
  const pending = app.change(task, { status: 'done' });
  app.handleTaskAuthChange('SIGNED_OUT', null);
  app.setup(db, { id: 'synthetic-user' });
  const message = app.info.textContent;
  db.finish({ error: { message: 'Synthetic old-session failure' } });
  await pending;
  assert.equal(task.status, 'todo');
  assert.equal(app.info.textContent, message);
  assert.doesNotMatch(app.info.textContent, /old-session failure/);
});

test('quick action without authentication does not write to Supabase', async () => {
  const app = harness(), db = deferredQuickActionDb();
  app.setup(db, null);
  await app.change({ id: 'synthetic-task', status: 'todo' }, { status: 'done' });
  assert.equal(db.requests.length, 0);
  assert.match(app.info.textContent, /Сначала войди/);
});
