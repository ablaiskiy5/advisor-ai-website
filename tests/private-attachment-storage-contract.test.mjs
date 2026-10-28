import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../scripts/smoke-private-attachment-storage-readonly.sql', import.meta.url), 'utf8');
const uncommented = sql.replace(/^\s*--.*$/gm, '');
const unquoted = uncommented.replace(/'(?:''|[^'])*'/g, "''");

test('private attachment storage audit cannot modify production data', () => {
  assert.equal((uncommented.match(/\bBEGIN READ ONLY;/g) || []).length, 1);
  assert.equal((uncommented.match(/\bROLLBACK;/g) || []).length, 1);
  assert.doesNotMatch(unquoted, /\b(?:INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|CALL|DO)\b/i);
  assert.doesNotMatch(uncommented, /\b(?:service_role|apikey|password|secret)\b/i);
  assert.doesNotMatch(uncommented, /\bFROM\s+storage\.objects\b/i);
});

test('private attachment bucket must remain private, capped and MIME-restricted', () => {
  assert.match(uncommented, /FROM storage\.buckets WHERE id = 'advisor-chat-attachments'/);
  assert.match(uncommented, /NOT public AS private/);
  assert.match(uncommented, /file_size_limit <= 5242880 AND file_size_limit > 0/);
  for (const mime of ['image/png','image/jpeg','image/webp','application/pdf']) {
    assert.ok(uncommented.includes("'" + mime + "'"), mime);
  }
  assert.match(uncommented, /allowed_mime_types @> ARRAY/);
  assert.match(uncommented, /allowed_mime_types <@ ARRAY/);
});

test('storage.objects owner policy drift fails closed on missing or extra policies', () => {
  for (const name of ['Owner attachment read','Owner attachment upload','Owner attachment delete']) {
    assert.ok(uncommented.includes("'" + name + "'"), name);
  }
  assert.match(uncommented, /p\.roles::text\[\] = ARRAY\['authenticated'\]::text\[\]/);
  assert.match(uncommented, /p\.cmd = e\.cmd/);
  assert.match(uncommented, /p\.permissive = 'PERMISSIVE'/);
  assert.match(uncommented, /tablename='objects'\) = 3/);
  assert.match(uncommented, /bool_and\(exists AND owner_shape_ok\)/);
  assert.match(uncommented, /c\.relname='objects' AND c\.relrowsecurity/);
  assert.match(uncommented, /THEN 'PASS' ELSE 'FAIL' END AS private_attachment_policy_contract/);
});

test('read, delete and upload must check owner folder; upload also checks case owner', () => {
  assert.match(uncommented, /e\.cmd IN \('SELECT', 'DELETE'\)/);
  assert.match(uncommented, /position\('storage\.foldername\(name\)' in p\.qual\)/);
  assert.match(uncommented, /position\('auth\.uid\(\)' in p\.qual\)/);
  assert.match(uncommented, /position\('\[1\]' in p\.qual\)/);
  assert.match(uncommented, /position\('\[2\]' in p\.with_check\)/);
  assert.match(uncommented, /position\('workspace_items' in p\.with_check\)/);
  assert.match(uncommented, /position\('w\.user_id' in p\.with_check\)/);
  assert.match(uncommented, /position\('EXISTS' in p\.with_check\)/);
  assert.match(uncommented, /p\.qual !~\*/);
  assert.match(uncommented, /p\.with_check !~\*/);
});
