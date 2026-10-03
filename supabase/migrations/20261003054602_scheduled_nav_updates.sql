alter table public.funds add column if not exists nav_as_of date;
alter table public.funds add column if not exists nav_checked_at timestamptz;
grant usage on schema public to service_role;
grant select(id,portfolio_id,name,units,nav_as_of), update(nav,current_value,nav_as_of,nav_checked_at) on public.funds to service_role;
grant select(fund_id,notes,type,portfolio_id,user_id) on public.transactions to service_role;
grant select(id,user_id) on public.portfolios to service_role;
create table if not exists public.nav_monitor_runs (
  id bigint generated always as identity primary key,
  checked_at timestamptz not null default now(),
  status text not null check(status in ('success','unavailable'))
);
alter table public.nav_monitor_runs enable row level security;
revoke all on public.nav_monitor_runs from public,anon,authenticated;
grant select(checked_at,status) on public.nav_monitor_runs to authenticated;
grant all on public.nav_monitor_runs to service_role;
grant usage,select on sequence public.nav_monitor_runs_id_seq to service_role;
drop policy if exists "Signed-in users can see feed health" on public.nav_monitor_runs;
create policy "Signed-in users can see feed health" on public.nav_monitor_runs for select to authenticated using(true);

create or replace function public.update_published_navs(p_quotes jsonb)
returns integer language plpgsql security invoker set search_path='' as $$
declare changed integer;
begin
  if jsonb_typeof(p_quotes)<>'array' or jsonb_array_length(p_quotes)>50000 then raise exception 'Invalid NAV list'; end if;
  with quotes as (
    select code,nav,as_of from jsonb_to_recordset(p_quotes) as q(code text,nav numeric,as_of date)
    where code ~ '^\d{1,12}$' and nav>0 and nav<1e6 and nav::text not in ('NaN','Infinity','-Infinity')
      and as_of between (now() at time zone 'Asia/Kolkata')::date-7 and (now() at time zone 'Asia/Kolkata')::date
  ), schemes as (
    select t.fund_id,substring(min(t.notes) from '^AMFI scheme (\d+)$') code
    from public.transactions t join public.funds f on f.id=t.fund_id join public.portfolios p on p.id=f.portfolio_id
    group by t.fund_id having count(*)=count(t.notes) and count(distinct t.notes)=1
      and bool_and(t.type='buy' and t.portfolio_id=f.portfolio_id and t.user_id=p.user_id)
  )
  update public.funds f set nav=q.nav,current_value=round(f.units*q.nav,2),nav_as_of=q.as_of,nav_checked_at=now()
    from schemes s join quotes q on q.code=s.code where f.id=s.fund_id and f.units>0
    and (f.nav_as_of is null or q.as_of>=f.nav_as_of)
    and round(f.units*q.nav,2)>0 and round(f.units*q.nav,2)<1e12
    and (f.name !~* '(^|[^a-z])ETF([^a-z]|$)|exchange.?traded' or f.name ~* 'fund.?of.?fund|(^|[^a-z])fof([^a-z]|$)');
  get diagnostics changed=row_count;
  insert into public.nav_monitor_runs(status) values('success');
  delete from public.nav_monitor_runs where checked_at<now()-interval '90 days';
  return changed;
end;
$$;
revoke all on function public.update_published_navs(jsonb) from public,anon,authenticated;
grant execute on function public.update_published_navs(jsonb) to service_role;
