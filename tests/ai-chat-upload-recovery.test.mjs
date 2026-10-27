import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const html = readFileSync(new URL('../ai-chat.html', import.meta.url), 'utf8');
const begin = html.indexOf('async function send()');
const end = html.indexOf('const quickOptions=', begin);
assert.ok(begin > 0 && end > begin, 'Use production chat send(), not a rewritten mock');

function scenario({ files = 2, failUploadAt = 0, failLinkAt = 0, failHistory = false } = {}) {
  const nodes = {
    question: { value: 'Synthetic portfolio analysis' },
    'file-status': { textContent: '' },
    retry: { hidden: false, classList: { add(name) { if (name === 'hidden') nodes.retry.hidden = true; } } }
  };
  const counters = { uploads: 0, linked: 0, history: 0, ai: 0, renders: 0, messages: [] };
  const pendingFiles = Array.from({ length: files }, (_, i) => ({
    name: 'synthetic-' + (i + 1) + '.pdf', type: 'application/pdf', size: 128
  }));
  const ctx = {
    user: { id: 'synthetic-owner' }, caseData: { id: 'synthetic-case' },
    caseId: 'synthetic-case', sessionEpoch: 1, working: false, voiceRecognition: null, pendingFiles,
    allowedFiles: { 'application/pdf': '.pdf' },
    crypto: { randomUUID: () => 'synthetic-uuid-' + counters.uploads },
    mimeForFile: () => 'application/pdf',
    $: id => nodes[id],
    waiting(v) { ctx.working = v; },
    error(value) { nodes.error = value; },
    renderFiles() { counters.renders++; },
    isCurrentChat(epoch, owner) { return epoch === ctx.sessionEpoch && owner === ctx.user?.id; },
    async history() { counters.history++; if (failHistory) throw Error('History temporarily unavailable'); },
    async requestAI() { counters.ai++; },
    db: {
      from(table) {
        if (table === 'advisor_ai_messages') return {
          insert(row) {
            assert.equal(row.user_id, 'synthetic-owner');
            counters.messages.push(row.content);
            return { select() { return { async single() {
              return { data: { id: 'synthetic-message' }, error: null };
            } }; } };
          }
        };
        assert.equal(table, 'advisor_ai_attachments');
        return { async insert(row) {
          assert.equal(row.user_id, 'synthetic-owner');
          counters.linked++;
          return { error: counters.linked === failLinkAt ? { message: 'metadata failed' } : null };
        } };
      },
      storage: { from(bucket) {
        assert.equal(bucket, 'advisor-chat-attachments');
        return { async upload() {
          counters.uploads++;
          return { error: counters.uploads === failUploadAt ? { message: 'upload failed' } : null };
        } };
      } }
    }
  };
  ctx.send = runInNewContext(html.slice(begin, end) + '\n;send', ctx);
  return { ctx, nodes, counters };
}

test('failed first upload never suggests that retrying AI will restore attachments', async () => {
  const s = scenario({ files: 2, failUploadAt: 1, failLinkAt: -1 });
  await s.ctx.send();
  assert.match(s.nodes.error, /0 из 2 вложений/);
  assert.match(s.nodes.error, /не загружает отсутствующие файлы/);
  assert.match(s.nodes.error, /новым сообщением перед анализом/);
  assert.equal(s.counters.ai, 0);
  assert.equal(s.ctx.pendingFiles.length, 2, 'Do not silently discard unuploaded files');
  assert.equal(s.nodes.question.value, '', 'Do not resubmit a message already saved');
  assert.equal(s.nodes.retry.hidden, true, 'Do not offer AI retry with missing attachments');
});

test('partial upload reports exactly the confirmed linked count', async () => {
  const s = scenario({ files: 2, failUploadAt: 2, failLinkAt: -1 });
  await s.ctx.send();
  assert.match(s.nodes.error, /1 из 2 вложений/);
  assert.equal(s.counters.linked, 1);
  assert.equal(s.counters.ai, 0);
  assert.deepEqual(s.ctx.pendingFiles.map(f => f.name), ['synthetic-2.pdf'], 'Keep only unlinked files');
  assert.equal(s.nodes.question.value, '', 'Original question is already saved');
  assert.equal(s.nodes.retry.hidden, true);
  assert.ok(s.counters.renders > 0, 'Refresh removable attachment chips after unlocking controls');
});

test('uploaded storage object without attachment metadata is not counted as linked', async () => {
  const s = scenario({ files: 1, failUploadAt: -1, failLinkAt: 1 });
  await s.ctx.send();
  assert.match(s.nodes.error, /0 из 1 вложений/);
  assert.equal(s.counters.ai, 0);
});

test('metadata failure after a linked file preserves only remaining files', async () => {
  const s = scenario({ files: 2, failUploadAt: -1, failLinkAt: 2 });
  await s.ctx.send();
  assert.match(s.nodes.error, /1 из 2 вложений/);
  assert.deepEqual(s.ctx.pendingFiles.map(f => f.name), ['synthetic-2.pdf']);
  assert.equal(s.counters.ai, 0);
});

test('resending after partial upload never reuploads the already linked first file', async () => {
  const s = scenario({ files: 2, failUploadAt: 2, failLinkAt: -1 });
  await s.ctx.send();
  assert.equal(s.counters.uploads, 2);
  await s.ctx.send();
  assert.equal(s.counters.uploads, 3, 'Only the remaining second file is uploaded');
  assert.equal(s.counters.linked, 2);
  assert.equal(s.counters.messages.length, 2);
  assert.match(s.counters.messages[1], /Проанализируй прикреплённые файлы/);
  assert.equal(s.counters.ai, 1);
  assert.equal(s.ctx.pendingFiles.length, 0);
});

test('history refresh failure after complete upload allows AI retry without reupload', async () => {
  const s = scenario({ files: 2, failUploadAt: -1, failLinkAt: -1, failHistory: true });
  await s.ctx.send();
  assert.match(s.nodes.error, /все вложения сохранены; можно нажать «Повторить ответ AI»/);
  assert.doesNotMatch(s.nodes.error, /не загружает отсутствующие файлы/);
  assert.equal(s.counters.linked, 2);
  assert.equal(s.counters.ai, 0);
});

test('successful upload and history refresh still start AI analysis', async () => {
  const s = scenario({ files: 1, failUploadAt: -1, failLinkAt: -1 });
  await s.ctx.send();
  assert.equal(s.counters.ai, 1);
  assert.equal(s.ctx.pendingFiles.length, 0);
  assert.equal(s.nodes.question.value, '');
});
