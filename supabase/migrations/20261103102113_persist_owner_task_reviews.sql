create table public.advisor_task_drafts (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null unique references auth.users(id) on delete cascade,
 source_text text not null check (char_length(source_text) between 3 and 10000),
 tasks jsonb not null default '[]'::jsonb check (jsonb_typeof(tasks)='array' and jsonb_array_length(tasks)<=30 and octet_length(tasks::text)<=400000),
 revision uuid not null default gen_random_uuid(),
 created_at timestamptz not null default now()
);
alter table public.advisor_task_drafts enable row level security;
revoke all on public.advisor_task_drafts from public, anon, authenticated;
grant select,insert,update,delete on public.advisor_task_drafts to authenticated;
grant select,insert,update,delete on public.advisor_task_drafts to service_role;
create policy "Task draft owner read" on public.advisor_task_drafts for select to authenticated using ((select auth.uid())=user_id);
create policy "Task draft owner create" on public.advisor_task_drafts for insert to authenticated with check ((select auth.uid())=user_id);
create policy "Task draft owner update" on public.advisor_task_drafts for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "Task draft owner delete" on public.advisor_task_drafts for delete to authenticated using ((select auth.uid())=user_id);
