import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../scripts/smoke-user-facing-rls-contract-readonly.sql', import.meta.url), 'utf8');
const uncommented = sql.replace(/^--.*$/gm, '');
const unquoted = uncommented.replace(/'[^']*'/g, "''");

test('owner-facing policy drift audit is read-only and rolled back', () => {
  assert.equal((uncommented.match(/\bBEGIN READ ONLY;/g) || []).length, 1);
  assert.equal((uncommented.match(/\bROLLBACK;/g) || []).length, 1);
  assert.doesNotMatch(unquoted, /\b(?:INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|CALL|DO)\b/i);
  assert.doesNotMatch(uncommented, /\b(?:service_role|apikey|password|secret)\b/i);
});

test('all five owner-facing tables require RLS and deny anonymous table and column grants', () => {
  for (const name of ['workspace_items', 'advisor_ai_messages', 'advisor_ai_attachments',
    'advisor_tasks', 'portfolio_snapshots']) {
    assert.equal(uncommented.split("'" + name + "'").length - 1, 1, name);
  }
  assert.ok(uncommented.includes('COALESCE(c.relrowsecurity, false) AS rls_enabled'));
  assert.ok(uncommented.includes("has_table_privilege('anon', c.oid"));
  assert.ok(uncommented.includes("has_any_column_privilege('anon', c.oid"));
  assert.ok(uncommented.includes("p.roles::text[] = ARRAY['authenticated']::text[]"));
  assert.ok(uncommented.includes("p.qual ~ 'auth[.]uid[(][)]'"));
  assert.ok(uncommented.includes("p.with_check ~ 'auth[.]uid[(][)]'"));
});

test('unexpected policies, owner-check drift or missing tables cannot produce PASS', () => {
  assert.match(uncommented, /policy_count=expected_count AND commands=expected_commands AND policies_owner_scoped/);
  assert.match(uncommented, /count\(\*\)=5 AND bool_and\(table_exists AND rls_enabled AND no_anonymous_grants/);
  assert.match(uncommented, /THEN 'PASS' ELSE 'FAIL' END AS owner_policy_contract/);
  assert.ok(uncommented.includes('p.with_check IS NOT NULL'));
  assert.ok(uncommented.includes('p.qual IS NOT NULL'));
  assert.ok(uncommented.includes("p.permissive = 'PERMISSIVE'"));
});

test('SQL-only TRUNCATE privileges are surfaced for review without changing grants', () => {
  assert.ok(uncommented.includes("has_table_privilege('authenticated', c.oid, 'TRUNCATE')"));
  assert.match(uncommented, /count\(\*\) FILTER \(WHERE authenticated_can_truncate\) AS authenticated_truncate_grants/);
});

test('SQL privilege review distinguishes direct TRUNCATE grants and callable public functions', () => {
  assert.match(uncommented, /aclexplode\(c\.relacl\)/);
  assert.match(uncommented, /AS direct_authenticated_truncate/);
  assert.match(uncommented, /AS public_truncate/);
  assert.match(uncommented, /AS direct_authenticated_truncate_grants/);
  assert.match(uncommented, /AS public_truncate_grants/);
  assert.match(uncommented, /has_function_privilege\('authenticated',p\.oid,'EXECUTE'\)/);
  assert.match(uncommented, /p\.prosecdef/);
  assert.match(uncommented, /AS authenticated_callable_public_definer_functions/);
  assert.match(uncommented, /has_schema_privilege\('authenticated','public','CREATE'\)/);
  assert.doesNotMatch(uncommented, /\b(?:prosrc|pg_get_functiondef|pg_get_function_identity_arguments)\b/i);
});
