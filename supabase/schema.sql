-- ============================================================================
-- Invesutra — Supabase Database Schema
-- Run this in the Supabase SQL Editor (or via `supabase db push`) to set up
-- all tables, indexes, and Row Level Security policies.
-- ============================================================================

-- Extension for UUID generation
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- USERS (mirrors auth.users, extended with app-specific profile fields)
-- ----------------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create a public.users row whenever a new auth user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;

  insert into public.subscriptions (user_id, plan, status)
  values (new.id, 'free', 'active')
  on conflict (user_id) do nothing;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ----------------------------------------------------------------------------
-- PORTFOLIOS
-- ----------------------------------------------------------------------------
create table if not exists public.portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_portfolios_user_id on public.portfolios(user_id);

-- ----------------------------------------------------------------------------
-- FUNDS
-- ----------------------------------------------------------------------------
create table if not exists public.funds (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  name text not null,
  category text not null,
  invested_amount numeric(14,2) not null default 0,
  current_value numeric(14,2) not null default 0,
  nav numeric(10,4) not null default 0,
  units numeric(14,4) not null default 0,
  returns_1y numeric(6,2) not null default 0,
  returns_3y numeric(6,2) not null default 0,
  returns_5y numeric(6,2) not null default 0,
  risk_level text not null default 'moderate',
  expense_ratio numeric(5,2) not null default 0,
  aum numeric(14,2) not null default 0,
  benchmark text,
  manager text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_funds_portfolio_id on public.funds(portfolio_id);

-- ----------------------------------------------------------------------------
-- TRANSACTIONS
-- ----------------------------------------------------------------------------
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  fund_id uuid not null references public.funds(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null check (type in ('buy', 'sell', 'rebalance', 'dividend')),
  amount numeric(14,2) not null,
  units numeric(14,4),
  nav numeric(10,4),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_transactions_portfolio_id on public.transactions(portfolio_id);
create index if not exists idx_transactions_user_id on public.transactions(user_id);

-- ----------------------------------------------------------------------------
-- AI REPORTS
-- ----------------------------------------------------------------------------
create table if not exists public.ai_reports (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  health_score integer not null,
  overall_health text not null,
  summary text not null,
  issues jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  risk_metrics jsonb not null default '{}'::jsonb,
  allocation_breakdown jsonb not null default '{}'::jsonb,
  algorithm_explanation text,
  generated_at timestamptz not null default now()
);

create index if not exists idx_ai_reports_portfolio_id on public.ai_reports(portfolio_id);
create index if not exists idx_ai_reports_user_id on public.ai_reports(user_id);

-- ----------------------------------------------------------------------------
-- SUBSCRIPTIONS
-- ----------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro', 'premium')),
  status text not null default 'active' check (status in ('active', 'trialing', 'past_due', 'cancelled', 'incomplete')),
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_subscriptions_user_id on public.subscriptions(user_id);
create index if not exists idx_subscriptions_stripe_customer_id on public.subscriptions(stripe_customer_id);

-- ----------------------------------------------------------------------------
-- ANALYSIS HISTORY (snapshots over time, used for trend charts)
-- ----------------------------------------------------------------------------
create table if not exists public.analysis_history (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  health_score integer not null,
  risk_score integer not null,
  diversification_score integer not null,
  total_value numeric(14,2) not null,
  total_invested numeric(14,2) not null,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_analysis_history_portfolio_id on public.analysis_history(portfolio_id);

-- ----------------------------------------------------------------------------
-- CHAT MESSAGES (persisted Sutra AI conversation history, per portfolio)
-- ----------------------------------------------------------------------------
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_chat_messages_portfolio_created on public.chat_messages(portfolio_id, created_at);

-- ----------------------------------------------------------------------------
-- updated_at triggers
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_updated_at_users on public.users;
create trigger set_updated_at_users before update on public.users
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at_portfolios on public.portfolios;
create trigger set_updated_at_portfolios before update on public.portfolios
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at_funds on public.funds;
create trigger set_updated_at_funds before update on public.funds
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at_subscriptions on public.subscriptions;
create trigger set_updated_at_subscriptions before update on public.subscriptions
  for each row execute procedure public.set_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table public.users enable row level security;
alter table public.portfolios enable row level security;
alter table public.funds enable row level security;
alter table public.transactions enable row level security;
alter table public.ai_reports enable row level security;
alter table public.subscriptions enable row level security;
alter table public.analysis_history enable row level security;
alter table public.chat_messages enable row level security;

-- USERS: users can read/update only their own row
drop policy if exists "Users can view own profile" on public.users;
create policy "Users can view own profile" on public.users
  for select using (auth.uid() = id);
drop policy if exists "Users can update own profile" on public.users;
create policy "Users can update own profile" on public.users
  for update using (auth.uid() = id);

-- PORTFOLIOS: full CRUD scoped to owner
drop policy if exists "Users can view own portfolios" on public.portfolios;
create policy "Users can view own portfolios" on public.portfolios
  for select using (auth.uid() = user_id);
drop policy if exists "Users can insert own portfolios" on public.portfolios;
create policy "Users can insert own portfolios" on public.portfolios
  for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update own portfolios" on public.portfolios;
create policy "Users can update own portfolios" on public.portfolios
  for update using (auth.uid() = user_id);
drop policy if exists "Users can delete own portfolios" on public.portfolios;
create policy "Users can delete own portfolios" on public.portfolios
  for delete using (auth.uid() = user_id);

-- FUNDS: scoped via parent portfolio ownership
drop policy if exists "Users can view own funds" on public.funds;
create policy "Users can view own funds" on public.funds
  for select using (
    exists (select 1 from public.portfolios p where p.id = funds.portfolio_id and p.user_id = auth.uid())
  );
drop policy if exists "Users can insert own funds" on public.funds;
create policy "Users can insert own funds" on public.funds
  for insert with check (
    exists (select 1 from public.portfolios p where p.id = funds.portfolio_id and p.user_id = auth.uid())
  );
drop policy if exists "Users can update own funds" on public.funds;
create policy "Users can update own funds" on public.funds
  for update using (
    exists (select 1 from public.portfolios p where p.id = funds.portfolio_id and p.user_id = auth.uid())
  );
drop policy if exists "Users can delete own funds" on public.funds;
create policy "Users can delete own funds" on public.funds
  for delete using (
    exists (select 1 from public.portfolios p where p.id = funds.portfolio_id and p.user_id = auth.uid())
  );

-- TRANSACTIONS: scoped to owner
drop policy if exists "Users can view own transactions" on public.transactions;
create policy "Users can view own transactions" on public.transactions
  for select using (auth.uid() = user_id);
drop policy if exists "Users can insert own transactions" on public.transactions;
create policy "Users can insert own transactions" on public.transactions
  for insert with check (auth.uid() = user_id);

-- AI REPORTS: scoped to owner
drop policy if exists "Users can view own reports" on public.ai_reports;
create policy "Users can view own reports" on public.ai_reports
  for select using (auth.uid() = user_id);
drop policy if exists "Users can insert own reports" on public.ai_reports;
create policy "Users can insert own reports" on public.ai_reports
  for insert with check (auth.uid() = user_id);
drop policy if exists "Users can delete own reports" on public.ai_reports;
create policy "Users can delete own reports" on public.ai_reports
  for delete using (auth.uid() = user_id);

-- SUBSCRIPTIONS: scoped to owner (read-only from client; writes happen via
-- the Stripe webhook using the service-role key, which bypasses RLS)
drop policy if exists "Users can view own subscription" on public.subscriptions;
create policy "Users can view own subscription" on public.subscriptions
  for select using (auth.uid() = user_id);

-- ANALYSIS HISTORY: scoped to owner
drop policy if exists "Users can view own analysis history" on public.analysis_history;
create policy "Users can view own analysis history" on public.analysis_history
  for select using (auth.uid() = user_id);
drop policy if exists "Users can insert own analysis history" on public.analysis_history;
create policy "Users can insert own analysis history" on public.analysis_history
  for insert with check (auth.uid() = user_id);

-- CHAT MESSAGES: scoped to owner, and insert additionally requires the
-- caller to actually own the parent portfolio (defense in depth alongside
-- the app-level ownership check in app/api/ai/portfolio-chat/route.ts)
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

-- ============================================================================
-- GRANTS
-- ============================================================================
-- RLS policies above only ever RESTRICT access that has already been
-- granted — Postgres still requires an explicit GRANT before the `anon` /
-- `authenticated` roles (the roles Supabase's PostgREST layer uses for
-- logged-out and logged-in requests) can touch a table at all. Without
-- this section, every query against these tables fails with
-- "permission denied for table X" before RLS is even evaluated, regardless
-- of how correct the policies above are.

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on
  public.users,
  public.portfolios,
  public.funds,
  public.transactions,
  public.ai_reports,
  public.subscriptions,
  public.analysis_history,
  public.chat_messages
to authenticated;

grant select on
  public.users,
  public.portfolios,
  public.funds,
  public.subscriptions
to anon;

-- Make sure any tables added in the future via `create table` in the SQL
-- editor automatically get these grants too, so this class of bug can't
-- recur silently.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant select on tables to anon;

grant usage, select on all sequences in schema public to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
