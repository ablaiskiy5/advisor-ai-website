import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../scripts/smoke-owner-rls-readonly.sql', import.meta.url), 'utf8');
const uncommented = sql.replace(/^--.*$/gm, '');

test('synthetic owner visibility smoke is read-only and transaction scoped', () => {
  assert.equal((uncommented.match(/\bBEGIN READ ONLY;/g) || []).length, 3);
  assert.equal((uncommented.match(/\bROLLBACK;/g) || []).length, 3);
  assert.equal((uncommented.match(/SET LOCAL ROLE authenticated;/g) || []).length, 2);
  assert.equal((uncommented.match(/SET LOCAL request\.jwt\.claim\.role = 'authenticated';/g) || []).length, 2);
  assert.doesNotMatch(uncommented, /\b(?:INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|CALL|DO)\b/i);
  assert.doesNotMatch(uncommented, /\b(?:service_role|apikey|password|secret)\b/i);
});

test('both non-user synthetic identities check owner-scoped tables and private storage', () => {
  for (const [suffix, label] of [['001', 'synthetic_a'], ['002', 'synthetic_b']]) {
    const id = '00000000-0000-4000-8000-000000000' + suffix;
    assert.match(uncommented, new RegExp("SET LOCAL request\\.jwt\\.claim\\.sub = '" + id + "';"));
    assert.match(uncommented, new RegExp("auth\\.uid\\(\\) = '" + id + "'::uuid"));
    assert.match(uncommented, new RegExp("SELECT '" + label + "' AS synthetic_identity"));
  }
  for (const resource of ['public.workspace_items', 'public.advisor_ai_messages',
    'public.advisor_ai_attachments', 'public.advisor_tasks', 'public.portfolio_snapshots',
    'storage.objects']) {
    assert.equal(uncommented.split(resource).length - 1, 3, resource);
  }
  assert.equal(uncommented.split("bucket_id = 'advisor-chat-attachments'").length - 1, 3);
  assert.equal(uncommented.split("THEN 'PASS' ELSE 'FAIL'").length - 1, 4);
});

test('anonymous role cannot read private tables or private attachment bucket', () => {
  assert.equal((uncommented.match(/SET LOCAL ROLE anon;/g) || []).length, 1);
  assert.match(uncommented, /SET LOCAL request\.jwt\.claim\.role = 'anon';/);
  assert.match(uncommented, /SET LOCAL request\.jwt\.claim\.sub = '';/);
  assert.match(uncommented, /current_user = 'anon' AS role_ok/);
  assert.match(uncommented, /auth\.uid\(\) IS NULL AS no_authenticated_user/);
  for (const table of ['workspace_items', 'advisor_ai_messages', 'advisor_ai_attachments',
    'advisor_tasks', 'portfolio_snapshots']) {
    assert.ok(uncommented.includes("has_table_privilege('anon', 'public." + table + "', 'SELECT')"), table);
  }
  assert.match(uncommented, /AS anonymous_private_table_grants/);
  assert.match(uncommented, /AS anonymous_private_storage_visibility/);
  assert.match(uncommented, /SELECT 'anonymous' AS synthetic_identity/);
});
