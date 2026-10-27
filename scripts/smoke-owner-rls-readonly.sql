-- Advisor AI: read-only, synthetic-identity RLS visibility smoke.
-- Run each transaction under a trusted administrative SQL connection.
-- Expected for both identities: role_ok=true, jwt_uid_ok=true, owner_isolation=PASS.
-- The UUIDs must not belong to registered users; confirm this before each live run.
-- All six private resources must return zero visible rows for either synthetic identity.
-- This tests SELECT visibility only. It does not test writes, browser sessions,
-- OAuth, signed URLs, or two independently authenticated real accounts.
-- No user records, attachment paths, file contents or secrets are returned.
-- Never treat this smoke test as corporate security approval.

BEGIN READ ONLY;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
SET LOCAL request.jwt.claim.role = 'authenticated';
WITH visible AS (
 SELECT (SELECT count(*) FROM public.workspace_items) AS cases,
        (SELECT count(*) FROM public.advisor_ai_messages) AS messages,
        (SELECT count(*) FROM public.advisor_ai_attachments) AS attachments,
        (SELECT count(*) FROM public.advisor_tasks) AS tasks,
        (SELECT count(*) FROM public.portfolio_snapshots) AS snapshots,
        (SELECT count(*) FROM storage.objects WHERE bucket_id = 'advisor-chat-attachments') AS private_files
)
SELECT 'synthetic_a' AS synthetic_identity,
       current_user = 'authenticated' AS role_ok,
       auth.uid() = '00000000-0000-4000-8000-000000000001'::uuid AS jwt_uid_ok,
       CASE WHEN cases=0 AND messages=0 AND attachments=0 AND tasks=0 AND snapshots=0 AND private_files=0
         THEN 'PASS' ELSE 'FAIL' END AS owner_isolation,
       cases, messages, attachments, tasks, snapshots, private_files
FROM visible;
ROLLBACK;

BEGIN READ ONLY;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000002';
SET LOCAL request.jwt.claim.role = 'authenticated';
WITH visible AS (
 SELECT (SELECT count(*) FROM public.workspace_items) AS cases,
        (SELECT count(*) FROM public.advisor_ai_messages) AS messages,
        (SELECT count(*) FROM public.advisor_ai_attachments) AS attachments,
        (SELECT count(*) FROM public.advisor_tasks) AS tasks,
        (SELECT count(*) FROM public.portfolio_snapshots) AS snapshots,
        (SELECT count(*) FROM storage.objects WHERE bucket_id = 'advisor-chat-attachments') AS private_files
)
SELECT 'synthetic_b' AS synthetic_identity,
       current_user = 'authenticated' AS role_ok,
       auth.uid() = '00000000-0000-4000-8000-000000000002'::uuid AS jwt_uid_ok,
       CASE WHEN cases=0 AND messages=0 AND attachments=0 AND tasks=0 AND snapshots=0 AND private_files=0
         THEN 'PASS' ELSE 'FAIL' END AS owner_isolation,
       cases, messages, attachments, tasks, snapshots, private_files
FROM visible;
ROLLBACK;
