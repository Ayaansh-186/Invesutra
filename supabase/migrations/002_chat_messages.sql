-- ============================================================================
-- Invesutra — Persistent Invesutra AI chat history
-- ============================================================================
-- Adds the chat_messages table so signed-in users' conversations survive a
-- page reload / new session, scoped to the portfolio they were chatting
-- about. Demo/guest sessions (no portfolio row in Supabase) are
-- unaffected — they keep the existing in-memory-only chat.
--
-- Run this once in the Supabase SQL editor (or `supabase db push`) if your
-- project already existed before chat_messages was added to schema.sql.
-- Idempotent — safe to re-run. Run 001_grants_fix.sql first if you haven't.
-- ============================================================================

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_chat_messages_portfolio_created on public.chat_messages(portfolio_id, created_at);

alter table public.chat_messages enable row level security;

drop policy if exists "Users can view own chat messages" on public.chat_messages;
create policy "Users can view own chat messages" on public.chat_messages
  for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own chat messages" on public.chat_messages;
create policy "Users can insert own chat messages" on public.chat_messages
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from public.portfolios p where p.id = chat_messages.portfolio_id and p.user_id = auth.uid())
  );

drop policy if exists "Users can delete own chat messages" on public.chat_messages;
create policy "Users can delete own chat messages" on public.chat_messages
  for delete using (auth.uid() = user_id);

-- Same grant this table needs at the Postgres level, same as
-- 001_grants_fix.sql — RLS alone doesn't grant table access.
grant select, insert, delete on public.chat_messages to authenticated;
