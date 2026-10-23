-- Restrict direct API invocation of the privileged RLS event-trigger function.
-- Safe to rerun. This changes function EXECUTE grants only: no tables,
-- policies, rows, keys, quotas, or event-trigger definitions are modified.
--
-- The event trigger ensure_rls invokes public.rls_auto_enable() when a table
-- is created. It is owned by postgres, which retains implicit EXECUTE rights.
-- Browser-facing anon/authenticated roles do not need to call it directly.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_event_trigger
    WHERE evtname = 'ensure_rls'
      AND evtfoid = 'public.rls_auto_enable()'::regprocedure
      AND evtenabled IN ('O', 'A')
  ) THEN
    RAISE EXCEPTION 'Expected enabled ensure_rls event trigger is missing; review before changing grants';
  END IF;
END
$$;

REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF has_function_privilege('anon', 'public.rls_auto_enable()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.rls_auto_enable()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Browser-facing roles must not execute rls_auto_enable()';
  END IF;
END
$$;
