-- Tighten public intake permissions after replacing the legacy demo schema.
-- Anonymous users can submit website visits and leads, but cannot read CRM data.

revoke all privileges on all tables in schema public from anon;

grant usage on schema public to anon;

grant select on
  lead_sources,
  campaigns
to anon;

grant insert on
  website_visits,
  leads
to anon;

drop policy if exists leads_insert_policy on leads;
drop policy if exists leads_anon_insert_policy on leads;
create policy leads_anon_insert_policy
on leads
for insert
to anon
with check (
  source_type is not null
  and assigned_to is null
  and status in ('new'::lead_status, 'contacted'::lead_status, 'quoted'::lead_status, 'nurturing'::lead_status)
  and (
    nullif(trim(coalesce(company_name, '')), '') is not null
    or nullif(trim(coalesce(contact_name, '')), '') is not null
    or nullif(trim(coalesce(email, '')), '') is not null
    or nullif(trim(coalesce(phone, '')), '') is not null
  )
);

drop policy if exists leads_authenticated_insert_policy on leads;
create policy leads_authenticated_insert_policy
on leads
for insert
to authenticated
with check (
  app_is_any_role(array['admin', 'manager', 'marketing'])
  or assigned_to = auth.uid()
  or assigned_to is null
);

drop policy if exists website_visits_insert_policy on website_visits;
create policy website_visits_insert_policy
on website_visits
for insert
to anon, authenticated
with check (nullif(trim(session_id), '') is not null);
