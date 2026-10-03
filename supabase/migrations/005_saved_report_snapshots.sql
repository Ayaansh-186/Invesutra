alter table public.ai_reports add column if not exists report_snapshot jsonb;
comment on column public.ai_reports.report_snapshot is
  'Versioned immutable report snapshot. Older rows retain their summary without invented historical details.';
