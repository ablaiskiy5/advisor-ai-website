import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../scripts/smoke-backend-only-rls-readonly.sql', import.meta.url), 'utf8');
const uncommented = sql.replace(/^--.*$/gm, '');
const unquoted = uncommented.replace(/'[^']*'/g, "''");

test('backend-only grant audit is a single read-only rolled-back transaction', () => {
  assert.equal((uncommented.match(/\bBEGIN READ ONLY;/g) || []).length, 1);
  assert.equal((uncommented.match(/\bROLLBACK;/g) || []).length, 1);
  assert.doesNotMatch(unquoted, /\b(?:INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|CALL|DO)\b/i);
  assert.doesNotMatch(uncommented, /\b(?:service_role|apikey|password|secret)\b/i);
});

test('all four backend-only tables require RLS, no browser policies and no grants', () => {
  for (const table of ['advisor_ai_access', 'advisor_ai_allowed_emails',
    'advisor_ai_request_reservations', 'advisor_task_ai_usage']) {
    assert.equal(uncommented.split("'" + table + "'").length - 1, 1, table);
  }
  assert.match(uncommented, /COALESCE\(c\.relrowsecurity, false\) AS rls_enabled/);
  assert.match(uncommented, /NOT EXISTS \(SELECT 1 FROM pg_policies/);
  assert.match(uncommented, /p\.schemaname = 'public' AND p\.tablename = e\.table_name/);
  for (const role of ['anon', 'authenticated']) {
    assert.ok(uncommented.includes("has_table_privilege('" + role + "', c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')"));
    assert.ok(uncommented.includes("has_any_column_privilege('" + role + "', c.oid, 'SELECT, INSERT, UPDATE, REFERENCES')"));
  }
});

test('missing tables or a failed condition cannot produce PASS', () => {
  assert.match(uncommented, /c\.oid IS NOT NULL AS table_exists/);
  assert.match(uncommented, /CASE WHEN c\.oid IS NULL THEN false ELSE NOT \(/);
  assert.match(uncommented, /count\(\*\) = 4 AND bool_and\(table_exists AND rls_enabled AND no_browser_policies AND no_browser_grants\)/);
  assert.match(uncommented, /THEN 'PASS' ELSE 'FAIL' END AS backend_only_boundary/);
});
