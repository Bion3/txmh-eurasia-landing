-- Remove older lightweight demo tables before installing the MVP schema.
-- Some early deployments used integer IDs for leads/shipments. The current
-- system requires UUID primary keys so quotes, orders, finance, and RLS policies
-- can share consistent references. Current project data model takes priority.

do $$
begin
  if to_regclass('public.leads') is not null
    and (
      not exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'leads'
          and column_name = 'id'
          and data_type = 'uuid'
      )
      or not exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'leads'
          and column_name = 'lead_no'
      )
    )
  then
    drop table public.leads cascade;
  end if;

  if to_regclass('public.shipments') is not null
    and (
      not exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'shipments'
          and column_name = 'id'
          and data_type = 'uuid'
      )
      or not exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'shipments'
          and column_name = 'order_id'
      )
    )
  then
    drop table public.shipments cascade;
  end if;
end $$;
