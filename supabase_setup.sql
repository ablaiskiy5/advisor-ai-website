-- Запускать только в SQL Editor своего Supabase проекта.
-- Никогда не выключать RLS для этой таблицы.
create table if not exists public.workspace_items (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('portfolio','ideas','academy','markets','tasks')),
  title text not null,
  status text not null default 'Новая',
  notes text not null default '',
  prompt text not null default '',
  chat_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists workspace_items_user_updated on public.workspace_items(user_id,updated_at desc);
alter table public.workspace_items enable row level security;
revoke all on public.workspace_items from anon;
grant select,insert,update,delete on public.workspace_items to authenticated;
drop policy if exists "Own items read" on public.workspace_items;
drop policy if exists "Own items insert" on public.workspace_items;
drop policy if exists "Own items update" on public.workspace_items;
drop policy if exists "Own items delete" on public.workspace_items;
create policy "Own items read" on public.workspace_items for select to authenticated using ((select auth.uid())=user_id);
create policy "Own items insert" on public.workspace_items for insert to authenticated with check ((select auth.uid())=user_id);
create policy "Own items update" on public.workspace_items for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "Own items delete" on public.workspace_items for delete to authenticated using ((select auth.uid())=user_id);
