drop policy if exists email_tasks_update_policy on email_tasks;
create policy email_tasks_update_policy
on email_tasks
for update
to authenticated
using (
  app_is_any_role(array['admin', 'manager', 'marketing'])
  or owner_id = auth.uid()
)
with check (
  app_is_any_role(array['admin', 'manager', 'marketing'])
  or owner_id = auth.uid()
);
