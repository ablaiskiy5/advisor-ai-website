-- Advisor AI pilot: server-only enrollment of newly approved accounts.
-- Applied to production on 2026-10-27 after error 42501
-- ("permission denied for table advisor_ai_access").
--
-- The chat Edge Function uses its server-side service_role credential and
-- upserts an allowlisted, email-confirmed user's access row on first use.
-- service_role had SELECT but not INSERT, so the initial request failed.
-- Do not give INSERT/UPDATE/DELETE/SELECT to anon or authenticated.
-- No RLS policies are weakened and this does not add anyone to allowlist.

DO $$
BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relname='advisor_ai_access'
     AND c.relkind IN ('r','p') AND c.relrowsecurity
 ) THEN
   RAISE EXCEPTION 'Expected RLS enabled on public.advisor_ai_access';
 END IF;
END $$;

GRANT INSERT ON TABLE public.advisor_ai_access TO service_role;

DO $$
BEGIN
 IF NOT has_table_privilege('service_role','public.advisor_ai_access','INSERT') THEN
   RAISE EXCEPTION 'AI server enrollment INSERT grant missing';
 END IF;
 IF has_table_privilege('anon','public.advisor_ai_access','INSERT')
    OR has_table_privilege('authenticated','public.advisor_ai_access','INSERT') THEN
   RAISE EXCEPTION 'Browser role must not be able to grant itself AI access';
 END IF;
END $$;
