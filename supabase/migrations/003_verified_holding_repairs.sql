begin;

create table if not exists public.holding_corrections (
  id uuid primary key default gen_random_uuid(),
  fund_id uuid not null references public.funds(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  before_data jsonb not null,
  after_data jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.holding_corrections enable row level security;
revoke all on public.holding_corrections from public, anon, authenticated;
grant select on public.holding_corrections to authenticated;
drop policy if exists "Owners can view holding corrections" on public.holding_corrections;
create policy "Owners can view holding corrections" on public.holding_corrections
  for select to authenticated using (
    user_id = auth.uid() and exists (
      select 1 from public.portfolios p where p.id = holding_corrections.portfolio_id and p.user_id = auth.uid()
    )
  );

-- The API verifies external NAVs; this function enforces ownership and atomic storage.
create or replace function public.repair_fund_purchase(p_fund_id uuid, p_purchase jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_fund public.funds%rowtype;
  v_purchase public.transactions%rowtype;
  v_history jsonb;
  v_count integer;
  v_code text;
  v_known_code text;
  v_date date;
  v_units numeric;
  v_buy_nav numeric;
  v_latest_nav numeric;
  v_cost numeric;
  v_value numeric;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select f.* into v_fund from public.funds f
    join public.portfolios p on p.id = f.portfolio_id
    where f.id = p_fund_id and p.user_id = auth.uid();
  if not found then raise exception 'Holding not found'; end if;
  -- Serialize corrections within a portfolio, including duplicate checks.
  perform 1 from public.portfolios where id = v_fund.portfolio_id and user_id = auth.uid() for update;
  if not found then raise exception 'Holding not found'; end if;
  select * into v_fund from public.funds where id = p_fund_id and portfolio_id = v_fund.portfolio_id for update;
  if not found then raise exception 'Holding not found'; end if;
  if v_fund.name ~* '(^|[^a-z])ETF([^a-z]|$)|exchange.?traded' then
    raise exception 'ETF corrections require a verified exchange-price source';
  end if;
  if p_purchase is null or jsonb_typeof(p_purchase) <> 'object' or
     not (p_purchase ?& array['schemeCode','purchaseDate','units','purchaseNav','latestNav','name','category','riskLevel','navAsOf']) then
    raise exception 'Invalid purchase details';
  end if;
  v_code := p_purchase->>'schemeCode';
  if v_code is null or v_code !~ '^[0-9]{1,12}$' or coalesce(p_purchase->>'purchaseDate','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'Invalid scheme or purchase date';
  end if;
  v_date := (p_purchase->>'purchaseDate')::date;
  v_units := (p_purchase->>'units')::numeric;
  v_buy_nav := (p_purchase->>'purchaseNav')::numeric;
  v_latest_nav := (p_purchase->>'latestNav')::numeric;
  if v_date is null or v_date < date '1900-01-01' or v_date > (now() at time zone 'Asia/Kolkata')::date or
     v_units is null or v_buy_nav is null or v_latest_nav is null or
     v_units::text in ('NaN','Infinity','-Infinity') or v_buy_nav::text in ('NaN','Infinity','-Infinity') or v_latest_nav::text in ('NaN','Infinity','-Infinity') or
     v_units <= 0 or v_units >= 1e10 or v_units <> round(v_units,4) or
     v_buy_nav <= 0 or v_buy_nav >= 1e6 or v_latest_nav <= 0 or v_latest_nav >= 1e6 or
     coalesce(length(trim(p_purchase->>'name')),0) = 0 or
     coalesce(p_purchase->>'category','') not in ('large_cap','mid_cap','small_cap','multi_cap','flexi_cap','debt','hybrid','index','sectoral','elss','international') or
     coalesce(p_purchase->>'riskLevel','') not in ('low','moderate','moderately_high','high','very_high') then
    raise exception 'Invalid purchase values';
  end if;
  v_cost := round(v_units * v_buy_nav,2);
  v_value := round(v_units * v_latest_nav,2);
  if v_cost <= 0 or v_cost >= 1e12 or v_value <= 0 or v_value >= 1e12 then raise exception 'Purchase values outside supported range'; end if;
  perform 1 from public.transactions where fund_id = p_fund_id for update;
  select count(*), coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into v_count, v_history
    from public.transactions t where t.fund_id = p_fund_id;
  if v_count > 1 then raise exception 'Multiple transactions cannot be corrected as one purchase'; end if;
  select * into v_purchase from public.transactions where fund_id = p_fund_id;
  if v_count = 1 and (v_purchase.type <> 'buy' or v_purchase.user_id <> auth.uid() or v_purchase.portfolio_id <> v_fund.portfolio_id) then
    raise exception 'Purchase history requires review';
  end if;
  v_known_code := substring(v_purchase.notes from '^AMFI scheme ([0-9]+)$');
  if v_known_code is not null and v_known_code <> v_code then raise exception 'The existing scheme cannot be changed'; end if;
  if exists (select 1 from public.transactions t where t.portfolio_id = v_fund.portfolio_id
      and t.fund_id <> p_fund_id and t.type = 'buy' and t.notes = 'AMFI scheme ' || v_code) or
     exists (select 1 from public.funds f where f.portfolio_id = v_fund.portfolio_id and f.id <> p_fund_id
      and lower(trim(f.name)) = lower(trim(p_purchase->>'name'))) then
    raise exception 'This exact scheme is already in your portfolio';
  end if;
  insert into public.holding_corrections (fund_id,portfolio_id,user_id,before_data,after_data)
    values (p_fund_id,v_fund.portfolio_id,auth.uid(),
      jsonb_build_object('fund',to_jsonb(v_fund),'transactions',v_history),p_purchase);
  update public.funds set name = p_purchase->>'name',category = p_purchase->>'category',
    risk_level = p_purchase->>'riskLevel',units = v_units,nav = v_latest_nav,
    invested_amount = v_cost,current_value = v_value,updated_at = now() where id = p_fund_id;
  if v_count = 1 then
    update public.transactions set amount = v_cost,units = v_units,nav = v_buy_nav,
      notes = 'AMFI scheme ' || v_code,created_at = (v_date + time '12:00') at time zone 'UTC'
      where id = v_purchase.id;
  else
    insert into public.transactions (fund_id,portfolio_id,user_id,type,amount,units,nav,notes,created_at)
      values (p_fund_id,v_fund.portfolio_id,auth.uid(),'buy',v_cost,v_units,v_buy_nav,
        'AMFI scheme ' || v_code,(v_date + time '12:00') at time zone 'UTC');
  end if;
end;
$$;
revoke all on function public.repair_fund_purchase(uuid,jsonb) from public, anon;
grant execute on function public.repair_fund_purchase(uuid,jsonb) to authenticated;

-- Parent ownership must also hold when records are inserted outside the app API.
drop policy if exists "Transaction parent ownership" on public.transactions;
create policy "Transaction parent ownership" on public.transactions as restrictive
  for insert to authenticated with check (
    user_id = auth.uid() and exists (
      select 1 from public.funds f join public.portfolios p on p.id = f.portfolio_id
      where f.id = transactions.fund_id and p.id = transactions.portfolio_id and p.user_id = auth.uid()
    )
  );
drop policy if exists "Report parent ownership" on public.ai_reports;
create policy "Report parent ownership" on public.ai_reports as restrictive
  for insert to authenticated with check (
    user_id = auth.uid() and exists (select 1 from public.portfolios p where p.id = ai_reports.portfolio_id and p.user_id = auth.uid())
  );
drop policy if exists "History parent ownership" on public.analysis_history;
create policy "History parent ownership" on public.analysis_history as restrictive
  for insert to authenticated with check (
    user_id = auth.uid() and exists (select 1 from public.portfolios p where p.id = analysis_history.portfolio_id and p.user_id = auth.uid())
  );
commit;
