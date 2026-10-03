-- Append only actual, reviewed allotments. One request is committed atomically.
create or replace function public.record_fund_purchases(p_fund_id uuid, p_purchases jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  f public.funds%rowtype;
  existing public.transactions%rowtype;
  item jsonb;
  request_id uuid;
  code text;
  bought date;
  quantity numeric;
  price numeric;
  latest numeric;
  cost numeric;
  saved_units numeric;
  saved_cost numeric;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select t.* into f from public.funds t join public.portfolios p on p.id=t.portfolio_id
    where t.id=p_fund_id and p.user_id=auth.uid();
  if not found then raise exception 'Holding not found'; end if;
  perform 1 from public.portfolios where id=f.portfolio_id and user_id=auth.uid() for update;
  select * into f from public.funds where id=p_fund_id for update;
  if not found then raise exception 'Holding not found'; end if;
  if p_purchases is null or jsonb_typeof(p_purchases) <> 'array' or jsonb_array_length(p_purchases) not between 1 and 200 then raise exception 'Invalid purchase list'; end if;
  if (select count(*) from public.transactions where fund_id=f.id) > 500 then raise exception 'Purchase history limit reached'; end if;
  if exists(select 1 from public.transactions where fund_id=f.id and (type <> 'buy' or user_id <> auth.uid() or portfolio_id <> f.portfolio_id or units is null or units<=0 or nav is null or nav<=0 or amount<=0)) then raise exception 'Unsupported transaction history'; end if;
  select sum(units),sum(amount) into saved_units,saved_cost from public.transactions where fund_id=f.id;
  if saved_units is null or abs(saved_units-f.units) > 0.00005 or abs(saved_cost-f.invested_amount)>0.02 then raise exception 'Correct existing purchase records before adding payments'; end if;
  for item in select value from jsonb_array_elements(p_purchases) loop
    request_id := (item->>'requestId')::uuid;
    code := item->>'schemeCode';
    bought := (item->>'purchaseDate')::date;
    quantity := (item->>'units')::numeric;
    price := (item->>'purchaseNav')::numeric;
    latest := (item->>'latestNav')::numeric;
    if request_id is null or code is null or code !~ '^\d{1,12}$' or bought is null or bought>(now() at time zone 'Asia/Kolkata')::date or bought<'1990-01-01'::date
      or quantity is null or quantity::text in ('NaN','Infinity','-Infinity') or quantity<=0 or quantity>=1e10 or round(quantity,4)<>quantity
      or price is null or price::text in ('NaN','Infinity','-Infinity') or price<=0 or price>=1e6
      or latest is null or latest::text in ('NaN','Infinity','-Infinity') or latest<=0 or latest>=1e6 then raise exception 'Invalid purchase details'; end if;
    if exists(select 1 from public.transactions where fund_id=f.id and notes is distinct from ('AMFI scheme '||code)) then raise exception 'The exact existing scheme must be retained'; end if;
    cost := round(quantity*price,2);
    select * into existing from public.transactions where id=request_id;
    if found then
      if existing.fund_id<>f.id or existing.user_id<>auth.uid() or existing.units<>quantity or abs(existing.nav-price)>0.0001 or existing.amount<>cost or (existing.created_at at time zone 'UTC')::date<>bought then raise exception 'Request ID already used for different purchase details'; end if;
      continue;
    end if;
    if exists(select 1 from public.transactions where fund_id=f.id and units=quantity and abs(nav-price)<0.0001 and (created_at at time zone 'UTC')::date=bought) then raise exception 'An identical allotment is already recorded; review the existing purchase'; end if;
    if (select count(*) from public.transactions where fund_id=f.id)>=500 then raise exception 'Purchase history limit reached'; end if;
    if cost<=0 or f.invested_amount+cost>=1e12 or f.units+quantity>=1e10 or round((f.units+quantity)*latest,2)>=1e12 then raise exception 'Purchase values outside supported range'; end if;
    insert into public.transactions(id,fund_id,portfolio_id,user_id,type,amount,units,nav,notes,created_at)
      values(request_id,f.id,f.portfolio_id,auth.uid(),'buy',cost,quantity,price,'AMFI scheme '||code,bought::timestamp at time zone 'UTC');
    update public.funds set units=units+quantity,invested_amount=invested_amount+cost,nav=latest,current_value=round((units+quantity)*latest,2) where id=f.id returning * into f;
  end loop;
end;
$$;
revoke all on function public.record_fund_purchases(uuid,jsonb) from public,anon;
grant execute on function public.record_fund_purchases(uuid,jsonb) to authenticated;
