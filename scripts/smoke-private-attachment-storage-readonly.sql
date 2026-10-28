-- Read-only drift detector for the private Workspace attachment bucket.
-- This checks the currently reviewed storage.objects policy SHAPE and bucket
-- limits. It is not proof of equivalent policy semantics, owner-positive
-- access, signed URL isolation, or authenticated two-user browser behavior.
-- Review expected names/commands after an approved policy migration.
-- Never query private attachment rows or object paths in this audit.
BEGIN READ ONLY;
WITH expected(policyname, cmd) AS (
  VALUES ('Owner attachment read', 'SELECT'),
         ('Owner attachment upload', 'INSERT'),
         ('Owner attachment delete', 'DELETE')
), policies AS (
  SELECT e.policyname, e.cmd, p.policyname IS NOT NULL AS exists,
    COALESCE(
      p.permissive = 'PERMISSIVE'
      AND p.roles::text[] = ARRAY['authenticated']::text[]
      AND p.cmd = e.cmd
      AND CASE WHEN e.cmd IN ('SELECT', 'DELETE') THEN
        p.qual IS NOT NULL
        AND position('bucket_id' in p.qual) > 0
        AND position('advisor-chat-attachments' in p.qual) > 0
        AND position('storage.foldername(name)' in p.qual) > 0
        AND position('[1]' in p.qual) > 0
        AND position('auth.uid()' in p.qual) > 0
        AND p.qual !~* '(^|[^[:alnum:]_])OR([^[:alnum:]_]|$)'
        AND p.with_check IS NULL
      ELSE
        p.qual IS NULL
        AND p.with_check IS NOT NULL
        AND position('bucket_id' in p.with_check) > 0
        AND position('advisor-chat-attachments' in p.with_check) > 0
        AND position('storage.foldername(name)' in p.with_check) > 0
        AND position('[1]' in p.with_check) > 0
        AND position('[2]' in p.with_check) > 0
        AND position('workspace_items' in p.with_check) > 0
        AND position('w.user_id' in p.with_check) > 0
        AND position('auth.uid()' in p.with_check) > 0
        AND position('EXISTS' in p.with_check) > 0
        AND p.with_check !~* '(^|[^[:alnum:]_])OR([^[:alnum:]_]|$)'
      END, false
    ) AS owner_shape_ok
  FROM expected e LEFT JOIN pg_policies p
    ON p.schemaname = 'storage' AND p.tablename = 'objects'
   AND p.policyname = e.policyname
), bucket AS (
  SELECT id, NOT public AS private,
    file_size_limit <= 5242880 AND file_size_limit > 0 AS size_capped,
    allowed_mime_types @> ARRAY['image/png','image/jpeg','image/webp','application/pdf']::text[]
      AND allowed_mime_types <@ ARRAY['image/png','image/jpeg','image/webp','application/pdf']::text[]
      AS mime_limited
  FROM storage.buckets WHERE id = 'advisor-chat-attachments'
)
SELECT
  (SELECT count(*) FROM pg_policies WHERE schemaname='storage' AND tablename='objects') AS object_policy_count,
  (SELECT count(*) FROM bucket) AS private_bucket_count,
  CASE WHEN
    (SELECT count(*) FROM pg_policies WHERE schemaname='storage' AND tablename='objects') = 3
    AND (SELECT bool_and(exists AND owner_shape_ok) FROM policies)
    AND (SELECT count(*) FROM bucket WHERE private AND size_capped AND mime_limited) = 1
    AND EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='storage' AND c.relname='objects' AND c.relrowsecurity)
  THEN 'PASS' ELSE 'FAIL' END AS private_attachment_policy_contract;
ROLLBACK;
