-- Eligibility is now confirmed self-registration, without per-email manual approval.
-- The legacy RPC name is retained for the existing chat and task Edge Functions.
create or replace function public.advisor_ai_is_allowed_email(p_email text)
returns boolean language sql stable security definer set search_path = '' as $$
 select auth.role()='service_role' and exists (
  select 1 from auth.users u
  where lower(btrim(u.email))=lower(btrim(p_email))
   and u.email_confirmed_at is not null
   and not exists (select 1 from public.advisor_ai_access a where a.user_id=u.id and not a.enabled)
 );
$$;
revoke all on function public.advisor_ai_is_allowed_email(text) from public,anon,authenticated;
grant execute on function public.advisor_ai_is_allowed_email(text) to service_role;

-- One transaction reserves the task request before the paid call.
-- Fixed server ceilings cannot be widened by request parameters.
create or replace function public.reserve_advisor_task_ai_request(p_user_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_user_count bigint; v_global_count bigint;
begin
 if auth.role() is distinct from 'service_role' then return 'forbidden'; end if;
 if p_user_id is null then return 'invalid'; end if;
 if not exists (select 1 from auth.users u where u.id=p_user_id and u.email_confirmed_at is not null)
  or exists (select 1 from public.advisor_ai_access a where a.user_id=p_user_id and not a.enabled)
 then return 'disabled'; end if;
 perform pg_catalog.pg_advisory_xact_lock(271828,314160);
 select count(*) into v_user_count from public.advisor_task_ai_usage
  where user_id=p_user_id and created_at>=now()-interval '24 hours';
 if v_user_count>=12 then return 'user_limit'; end if;
 select count(*) into v_global_count from public.advisor_task_ai_usage
  where created_at>=now()-interval '24 hours';
 if v_global_count>=150 then return 'global_limit'; end if;
 insert into public.advisor_task_ai_usage(user_id) values(p_user_id);
 return 'ok';
end;
$$;
revoke all on function public.reserve_advisor_task_ai_request(uuid) from public,anon,authenticated;
grant execute on function public.reserve_advisor_task_ai_request(uuid) to service_role;
