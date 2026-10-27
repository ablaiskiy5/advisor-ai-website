-- Advisor AI: read-only privilege/RLS contract for four backend-only tables.
-- Run using a trusted administrative SQL connection; no table rows are read.
-- Expected: expected_table_count=4, backend_only_boundary=PASS.
-- Checks both table-level and column-level grants for anon/authenticated.
-- Does not test user login, owner-positive access, writes or Edge Function behavior.
-- Never treat this as a substitute for authenticated two-account browser QA.

BEGIN READ ONLY;
WITH expected(table_name) AS (
  VALUES ('advisor_ai_access'), ('advisor_ai_allowed_emails'),
         ('advisor_ai_request_reservations'), ('advisor_task_ai_usage')
), audit AS (
  SELECT e.table_name,
         c.oid IS NOT NULL AS table_exists,
         COALESCE(c.relrowsecurity, false) AS rls_enabled,
         NOT EXISTS (SELECT 1 FROM pg_policies p
                     WHERE p.schemaname = 'public' AND p.tablename = e.table_name) AS no_browser_policies,
         CASE WHEN c.oid IS NULL THEN false ELSE NOT (
           has_table_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
           OR has_table_privilege('authenticated', c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
           OR has_any_column_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, REFERENCES')
           OR has_any_column_privilege('authenticated', c.oid, 'SELECT, INSERT, UPDATE, REFERENCES')
         ) END AS no_browser_grants
  FROM expected e
  LEFT JOIN pg_namespace n ON n.nspname = 'public'
  LEFT JOIN pg_class c ON c.relnamespace = n.oid AND c.relname = e.table_name AND c.relkind IN ('r', 'p')
)
SELECT count(*) AS expected_table_count,
       CASE WHEN count(*) = 4 AND bool_and(table_exists AND rls_enabled AND no_browser_policies AND no_browser_grants)
            THEN 'PASS' ELSE 'FAIL' END AS backend_only_boundary
FROM audit;
ROLLBACK;
