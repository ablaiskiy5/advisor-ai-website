import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// GitHub Pages serves the repository's public frontend and script assets.
// This is a best-effort credential guard, not a replacement for secret scanning
// or Supabase RLS. Never print matched credential values in CI logs.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const signatures = [
  ['Supabase secret key', /\bsb_secret_[A-Za-z0-9_-]{8,}\b/],
  ['OpenAI API key', /\bsk-(?:(?:proj|svcacct|admin)-)?[A-Za-z0-9_-]{20,}\b/],
  ['GitHub access token', /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b/],
  ['AWS access key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['Private key', /-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/],
  ['Embedded JWT', /\beyJ[A-Za-z0-9_-]{6,}\.eyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{8,}\b/]
];

function credentialTypes(source) {
  return signatures.filter(([, pattern]) => pattern.test(source)).map(([name]) => name);
}

function publicSourceFiles() {
  const allowed = /\.(?:html|css|js|mjs)$/i;
  const rootFiles = readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isFile() && allowed.test(entry.name))
    .map(entry => entry.name);
  const scriptFiles = readdirSync(join(root, 'scripts'), { withFileTypes: true })
    .filter(entry => entry.isFile() && allowed.test(entry.name))
    .map(entry => join('scripts', entry.name));
  return [...rootFiles, ...scriptFiles].sort();
}

test('guard recognizes common private credential formats without logging values', () => {
  const jwt = [
    Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'),
    Buffer.from('{"role":"service_role"}').toString('base64url'),
    'a'.repeat(32)
  ].join('.');
  const examples = [
    ['Supabase secret key', 'sb_' + 'secret_' + 'A'.repeat(24)],
    ['OpenAI API key', 'sk-' + 'A'.repeat(40)],
    ['GitHub access token', 'ghp_' + 'A'.repeat(36)],
    ['AWS access key', 'AKIA' + 'A'.repeat(16)],
    ['Private key', '-----BEGIN ' + 'PRIVATE KEY-----'],
    ['Embedded JWT', jwt]
  ];
  for (const [expected, value] of examples) {
    assert.ok(credentialTypes(value).includes(expected), 'Missing detector: ' + expected);
  }
});

test('guard permits public browser configuration and harmless documentation', () => {
  assert.deepEqual(credentialTypes(
    'sb_publishable_example123 service_role is forbidden in frontend code; ' +
    'an Authorization header built from a user session is not a hard-coded token.'
  ), []);
});

test('public HTML, CSS and JS assets contain no recognizable private credentials', () => {
  const files = publicSourceFiles();
  assert.ok(files.length >= 7, 'Expected public frontend files to be present');
  for (const path of files) {
    const types = credentialTypes(readFileSync(join(root, path), 'utf8'));
    assert.deepEqual(types, [], path + ': potential ' + types.join(', ') +
      '. Remove the credential from the public repository and rotate it.');
  }
});
