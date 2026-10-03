-- Optional plans are not transactions and do not change financial totals.
alter table public.funds add column if not exists monthly_sip_amount numeric(14,2);
alter table public.funds drop constraint if exists funds_monthly_sip_amount_check;
alter table public.funds add constraint funds_monthly_sip_amount_check
  check (monthly_sip_amount > 0 and monthly_sip_amount < 1000000000);
comment on column public.funds.monthly_sip_amount is
  'Planned monthly SIP contribution; not a payment mandate or executed purchase.';
