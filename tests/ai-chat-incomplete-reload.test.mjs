import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const html = readFileSync(new URL('../ai-chat.html', import.meta.url), 'utf8');
function productionSlice(start, end) {
  const a = html.indexOf(start), b = html.indexOf(end, a);
  assert.ok(a > 0 && b > a, 'Production source boundaries must exist');
  return html.slice(a, b);
}
const helpers = productionSlice('const incompleteUploadFallback=', 'const error=s=>');
const historySource = productionSlice('async function history()', 'async function requestAI()');
const requestSource = productionSlice('async function requestAI()', 'const allowedFiles=');

function fixture(messageId = 'synthetic-message', storage = new Map(), storageDisabled = false, attachmentError = false) {
  let failAttachmentHistory = attachmentError;
  const sessionStorage = {
    setItem(k, v) { if (storageDisabled) throw Error('disabled'); storage.set(k, v); },
    getItem(k) { if (storageDisabled) throw Error('disabled'); return storage.get(k) ?? null; },
    removeItem(k) { if (storageDisabled) throw Error('disabled'); storage.delete(k); }
  };
  const helpersContext = { sessionStorage };
  const f = runInNewContext(helpers + '\n;({markIncompleteUpload,incompleteUploadFor,clearIncompleteUpload})', helpersContext);
  const nodes = {
    messages: { textContent: '', children: [], append(node) { this.children.push(node); }, scrollHeight: 0, scrollTop: 0 },
    retry: { hidden: false, classList: {
      toggle(name, hidden) { assert.equal(name, 'hidden'); nodes.retry.hidden = hidden; },
      add(name) { assert.equal(name, 'hidden'); nodes.retry.hidden = true; }
    } }
  };
  let aiCalls = 0, warning = '';
  const ctx = {
    db: {
      from(table) {
        const result = table === 'advisor_ai_messages'
          ? { data: [{ id: messageId, role: 'user', content: 'Synthetic input', created_at: '2026-10-27' }], error: null }
          : { data: [], error: failAttachmentHistory ? { message: 'synthetic attachment metadata outage' } : null };
        const builder = {
          select() { return this; }, eq() { return this; }, in() { return this; }, order() { return this; },
          limit() { return Promise.resolve(result); }
        };
        return builder;
      },
      functions: { async invoke() { aiCalls++; return { data: {}, error: null }; } }
    },
    user: { id: 'owner-A' }, caseData: { id: 'case-A' }, caseId: 'case-A',
    sessionEpoch: 1, working: false, lastAnswer: '', latestUserMessageId: null,
    attachmentHistoryVerified: false,
    exhaustedRetryMessages: new Set(),
    isCurrentChat(epoch, owner) { return epoch === 1 && owner === ctx.user.id; },
    waiting() {}, bubble() { return { append() {} }; },
    error(value) { warning = value; },
    $: id => nodes[id] || { textContent: '' },
    ...f
  };
  const history = runInNewContext(historySource + '\n;history', ctx);
  const requestAI = runInNewContext(requestSource + '\n;requestAI', ctx);
  return { ctx, f, nodes, history, requestAI, storage,
    setAttachmentError(value) { failAttachmentHistory = value; },
    get warning() { return warning; }, get aiCalls() { return aiCalls; } };
}

test('partial upload marker survives a simulated page reload without storing file data', async () => {
  const storage = new Map();
  const first = fixture('msg-1', storage);
  first.f.markIncompleteUpload('owner-A', 'case-A', 'msg-1');
  assert.equal(storage.size, 1);
  assert.ok([...storage.values()].every(value => value === 'msg-1'));
  const reloaded = fixture('msg-1', storage);
  await reloaded.history();
  assert.equal(reloaded.nodes.retry.hidden, true);
  assert.match(reloaded.warning, /не все вложения загружены/);
  await reloaded.requestAI();
  assert.equal(reloaded.aiCalls, 0, 'Incomplete saved message must not invoke paid AI');
});

test('marker cannot block another owner or case', async () => {
  const s = fixture('msg-1');
  s.f.markIncompleteUpload('owner-A', 'case-A', 'msg-1');
  assert.equal(s.f.incompleteUploadFor('owner-B', 'case-A'), null);
  assert.equal(s.f.incompleteUploadFor('owner-A', 'case-B'), null);
  s.ctx.user = { id: 'owner-B' };
  await s.history();
  assert.equal(s.nodes.retry.hidden, false);
});

test('newer saved user message clears old incomplete marker and restores retry', async () => {
  const s = fixture('msg-2');
  s.f.markIncompleteUpload('owner-A', 'case-A', 'msg-1');
  await s.history();
  assert.equal(s.f.incompleteUploadFor('owner-A', 'case-A'), null);
  assert.equal(s.nodes.retry.hidden, false);
});

test('disabled session storage still blocks paid AI retry in the current page', async () => {
  const s = fixture('msg-1', new Map(), true);
  assert.doesNotThrow(() => s.f.markIncompleteUpload('owner-A', 'case-A', 'msg-1'));
  assert.equal(s.f.incompleteUploadFor('owner-A', 'case-A'), 'msg-1');
  assert.equal(s.storage.size, 0, 'No data was written to disabled browser storage');
  assert.equal(s.f.incompleteUploadFor('owner-B', 'case-A'), null);
  assert.equal(s.f.incompleteUploadFor('owner-A', 'case-B'), null);
  await s.history();
  assert.equal(s.nodes.retry.hidden, true);
  await s.requestAI();
  assert.equal(s.aiCalls, 0, 'Blocked storage must not allow a paid retry in the current page');
  s.f.clearIncompleteUpload('owner-A', 'case-A', 'msg-1');
  assert.equal(s.f.incompleteUploadFor('owner-A', 'case-A'), null);
});

test('attachment metadata failure hides retry and blocks paid AI until a successful history refresh', async () => {
  const s = fixture('msg-1', new Map(), false, true);
  await s.history();
  assert.equal(s.ctx.attachmentHistoryVerified, false);
  assert.equal(s.nodes.retry.hidden, true, 'Never offer AI retry with unverified attachment history');
  assert.match(s.warning, /История файлов временно недоступна/);
  await s.requestAI();
  assert.equal(s.aiCalls, 0, 'No paid AI call when attachment metadata is unavailable');
  assert.match(s.warning, /не удалось проверить историю вложений/);

  s.setAttachmentError(false);
  await s.history();
  assert.equal(s.ctx.attachmentHistoryVerified, true);
  assert.equal(s.nodes.retry.hidden, false, 'Retry becomes available after metadata is verified');
});
