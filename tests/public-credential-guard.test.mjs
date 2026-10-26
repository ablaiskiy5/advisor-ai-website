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

// GitHub Pages exposes more than the browser entrypoints: repository documentation,
// CI workflows and migration examples are also public and must not carry credentials.
// Deliberately exclude tests/ because they contain synthetic credential fixtures.
function publicTextFilesIn(relativeDir, allowed) {
  return readdirSync(join(root, relativeDir), { withFileTypes: true }).flatMap(entry => {
    const relativePath = join(relativeDir, entry.name);
    if (entry.isDirectory()) return publicTextFilesIn(relativePath, allowed);
    return entry.isFile() && allowed.test(entry.name) ? [relativePath] : [];
  });
}

function publicSourceFiles() {
  const rootAllowed = /\.(?:html|css|js|mjs|md|sql|json|yml|yaml|toml)$/i;
  const rootFiles = readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isFile() && rootAllowed.test(entry.name))
    .map(entry => entry.name);
  return [
    ...rootFiles,
    ...publicTextFilesIn('scripts', /\.(?:js|mjs|ts|json)$/i),
    ...publicTextFilesIn('docs', /\.(?:md|txt|html|json)$/i),
    ...publicTextFilesIn('.github/workflows', /\.(?:yml|yaml|json)$/i),
    ...publicTextFilesIn('supabase', /\.(?:sql|ts|js|json|toml)$/i)
  ].sort();
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

test('guard scans public docs, workflows and SQL migrations, not only browser assets', () => {
  const files = publicSourceFiles();
  for (const path of [
    'README.md',
    'PROJECT_STATE.md',
    'docs/ADVISOR_AI_CORE.md',
    '.github/workflows/integrated-quality.yml',
    'supabase_setup.sql',
    'supabase/migrations/20261023_restrict_rls_event_trigger_execute.sql'
  ]) {
    assert.ok(files.includes(path), 'Public text file missing from credential scan: ' + path);
  }
  assert.ok(files.every(path => !path.startsWith('tests/')), 'Synthetic fixtures must not be scanned');
});

test('public repository text assets contain no recognizable private credentials', () => {
  const files = publicSourceFiles();
  assert.ok(files.length >= 7, 'Expected public frontend files to be present');
  for (const path of files) {
    const types = credentialTypes(readFileSync(join(root, path), 'utf8'));
    assert.deepEqual(types, [], path + ': potential ' + types.join(', ') +
      '. Remove the credential from the public repository and rotate it.');
  }
});
