-- ============================================================================
-- Invesutra — Fix "permission denied for table X" errors
-- ============================================================================
-- Root cause: schema.sql enables Row Level Security and creates policies,
-- but RLS policies only ever RESTRICT access that has already been
-- granted. Postgres still requires an explicit GRANT on the table/schema
-- before the `anon` / `authenticated` roles (the roles Supabase's
-- PostgREST layer uses for logged-out and logged-in requests) can touch
-- the table at all. If your tables were created by a role/session that
-- didn't inherit Supabase's default privileges, Postgres returns
-- "permission denied for table X" before RLS is even evaluated.
--
-- Run this once in the Supabase SQL editor (or `supabase db push`) if your
-- project already existed before this file was added. Fresh projects get
-- the same grants automatically from the bottom of schema.sql. Idempotent
-- — safe to re-run.
-- ============================================================================

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on
  public.users,
  public.portfolios,
  public.funds,
  public.transactions,
  public.ai_reports,
  public.subscriptions,
  public.analysis_history
to authenticated;

grant select on
  public.users,
  public.portfolios,
  public.funds,
  public.subscriptions
to anon;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant select on tables to anon;

grant usage, select on all sequences in schema public to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
