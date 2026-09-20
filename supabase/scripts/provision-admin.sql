-- Trusted operator only. Creates no Auth user and is never called by the website.
-- Required psql variables: admin_user_id, admin_display_name.
-- Run with ON_ERROR_STOP=1 against the intended database after the migration.
begin;

insert into public.profiles (id, display_name, role)
values (:'admin_user_id'::uuid, :'admin_display_name', 'admin')
on conflict (id) do update
  set display_name = excluded.display_name;

-- A different existing administrator fails the unique role constraint.
-- A nonexistent Auth user fails the foreign key. There is no role replacement.
commit;
