import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const html = readFileSync(new URL('../ai-chat.html', import.meta.url), 'utf8');
const start = html.indexOf('async function downloadDocx()');
const end = html.indexOf('function downloadWord()', start);
const guardStart = html.indexOf('function isCurrentChat(');
const guardEnd = html.indexOf('function resetChatSession()', guardStart);
assert.ok(start >= 0 && end > start && guardStart >= 0 && guardEnd > guardStart,
  'Test the actual production DOCX export and session guard');

function setup() {
  let resolveBlob, rejectBlob;
  const pendingBlob = new Promise((resolve, reject) => {
    resolveBlob = resolve;
    rejectBlob = reject;
  });
  const downloads = [];
  let createdUrls = 0;
  const nodes = {
    'download-docx': { disabled: false, textContent: '' },
    'result-status': { textContent: '' }
  };
  const docx = {
    Document: class Document {},
    Paragraph: class Paragraph {},
    TextRun: class TextRun {},
    Table: class Table {},
    HeadingLevel: { TITLE: 'title' },
    Packer: { toBlob: () => pendingBlob }
  };
  const context = {
    sessionEpoch: 0,
    user: { id: 'synthetic-owner-A' },
    caseData: { title: 'Synthetic confidential report' },
    lastAnswer: 'Synthetic report content',
    working: false,
    window: { docx },
    $: id => nodes[id],
    docxParagraphs: () => [],
    fileName: () => 'synthetic-report',
    URL: {
      createObjectURL: () => { createdUrls++; return 'blob:synthetic'; },
      revokeObjectURL() {}
    },
    document: {
      createElement: () => ({
        download: '',
        href: '',
        click() { downloads.push(this.download); },
        remove() {}
      }),
      body: { append() {} }
    },
    setTimeout() {}
  };
  const source = html.slice(guardStart, guardEnd) + '\n' +
    html.slice(start, end) + '\n({ downloadDocx })';
  const { downloadDocx } = runInNewContext(source, context);
  return { context, nodes, downloads, downloadDocx, resolveBlob, rejectBlob,
    get createdUrls() { return createdUrls; } };
}

test('DOCX download succeeds for the unchanged authenticated session', async () => {
  const t = setup();
  const running = t.downloadDocx();
  t.resolveBlob({ size: 2048 });
  await running;
  assert.deepEqual(t.downloads, ['AdvisorAI-synthetic-report.docx']);
  assert.equal(t.createdUrls, 1);
  assert.match(t.nodes['result-status'].textContent, /Скачан настоящий/);
  assert.equal(t.nodes['download-docx'].disabled, false);
});

test('sign-out while DOCX generation is pending prevents a private download', async () => {
  const t = setup();
  const running = t.downloadDocx();
  t.context.sessionEpoch++;
  t.context.user = null;
  t.context.caseData = null;
  t.context.lastAnswer = '';
  t.nodes['download-docx'].disabled = true;
  t.nodes['download-docx'].textContent = 'Signed out';
  t.resolveBlob({ size: 2048 });
  await running;
  assert.equal(t.createdUrls, 0);
  assert.deepEqual(t.downloads, []);
  assert.equal(t.nodes['result-status'].textContent, '');
  assert.equal(t.nodes['download-docx'].textContent, 'Signed out');
  assert.equal(t.nodes['download-docx'].disabled, true);
});

test('same-account re-login does not resume the previous DOCX export', async () => {
  const t = setup();
  const running = t.downloadDocx();
  t.context.sessionEpoch++;
  t.context.user = { id: 'synthetic-owner-A' };
  t.context.caseData = { title: 'New session' };
  t.context.lastAnswer = 'New answer';
  t.resolveBlob({ size: 2048 });
  await running;
  assert.equal(t.createdUrls, 0);
  assert.deepEqual(t.downloads, []);
  assert.equal(t.nodes['result-status'].textContent, '');
});

test('late DOCX generator errors cannot overwrite another account status', async () => {
  const t = setup();
  const running = t.downloadDocx();
  t.context.sessionEpoch++;
  t.context.user = { id: 'synthetic-owner-B' };
  t.context.caseData = { title: 'Another account' };
  t.nodes['result-status'].textContent = 'Current account status';
  t.rejectBlob(new Error('old session generator failed'));
  await running;
  assert.equal(t.nodes['result-status'].textContent, 'Current account status');
  assert.equal(t.createdUrls, 0);
  assert.deepEqual(t.downloads, []);
});
