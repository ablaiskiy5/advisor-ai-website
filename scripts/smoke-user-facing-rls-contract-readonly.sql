-- Read-only drift audit for the five owner-scoped Workspace tables.
-- Run with a trusted administrative SQL connection. No private rows are read.
-- PASS checks the CURRENT policy shape, not owner-positive browser behavior.
-- The TRUNCATE count is a separate defense-in-depth review signal:
-- RLS does not apply to TRUNCATE, but this audit does not establish a browser
-- exploit path. Do not alter live grants without an approved migration/review.
-- Re-run after intended RLS changes and update the expected command sets.
BEGIN READ ONLY;
WITH expected(table_name, expected_commands, expected_count) AS (
 VALUES ('workspace_items', 'DELETE,INSERT,SELECT,UPDATE', 4),
        ('advisor_ai_messages', 'INSERT,SELECT', 2),
        ('advisor_ai_attachments', 'INSERT,SELECT', 2),
        ('advisor_tasks', 'DELETE,INSERT,SELECT,UPDATE', 4),
        ('portfolio_snapshots', 'DELETE,INSERT,SELECT', 3)
), audited AS (
 SELECT e.table_name, c.oid IS NOT NULL AS table_exists,
        COALESCE(c.relrowsecurity, false) AS rls_enabled,
        CASE WHEN c.oid IS NULL THEN false ELSE NOT (
          has_table_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
          OR has_any_column_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, REFERENCES')
        ) END AS no_anonymous_grants,
        CASE WHEN c.oid IS NULL THEN false ELSE
          has_table_privilege('authenticated', c.oid, 'TRUNCATE')
        END AS authenticated_can_truncate,
        (SELECT count(*) FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=e.table_name) AS policy_count,
        (SELECT string_agg(p.cmd, ',' ORDER BY p.cmd) FROM pg_policies p
         WHERE p.schemaname='public' AND p.tablename=e.table_name) AS commands,
        COALESCE((SELECT bool_and(
          p.permissive = 'PERMISSIVE'
          AND p.roles::text[] = ARRAY['authenticated']::text[]
          AND (p.cmd NOT IN ('SELECT','UPDATE','DELETE')
            OR (p.qual IS NOT NULL AND p.qual ~ 'auth[.]uid[(][)]'
                AND p.qual ~ 'user_id' AND p.qual !~* '(^|[^[:alnum:]_])OR([^[:alnum:]_]|$)'))
          AND (p.cmd NOT IN ('INSERT','UPDATE')
            OR (p.with_check IS NOT NULL AND p.with_check ~ 'auth[.]uid[(][)]'
                AND p.with_check ~ 'user_id' AND p.with_check !~* '(^|[^[:alnum:]_])OR([^[:alnum:]_]|$)'))
        ) FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=e.table_name), false) AS policies_owner_scoped,
        e.expected_commands, e.expected_count
 FROM expected e LEFT JOIN pg_namespace n ON n.nspname='public'
 LEFT JOIN pg_class c ON c.relnamespace=n.oid AND c.relname=e.table_name AND c.relkind IN ('r','p')
)
SELECT count(*) AS expected_table_count,
 CASE WHEN count(*)=5 AND bool_and(table_exists AND rls_enabled AND no_anonymous_grants
   AND policy_count=expected_count AND commands=expected_commands AND policies_owner_scoped)
 THEN 'PASS' ELSE 'FAIL' END AS owner_policy_contract,
 count(*) FILTER (WHERE authenticated_can_truncate) AS authenticated_truncate_grants
FROM audited;
ROLLBACK;
