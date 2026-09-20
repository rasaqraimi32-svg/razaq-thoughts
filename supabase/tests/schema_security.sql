-- Regression tests for a FRESH, disposable local Supabase database only.
-- Apply migrations first, then run with psql -X -v ON_ERROR_STOP=1 -f this-file.
-- No extensions or application packages required. Every fixture is rolled back.
begin;
set local plpgsql.check_asserts = on;

-- A fresh database must have no profiles, articles, or comments.
do $$
begin
  assert (select count(*) from public.profiles) = 0, 'Use a fresh test database';
  assert (select count(*) from public.articles) = 0, 'Use a fresh test database';
  assert (select count(*) from public.comments) = 0, 'Use a fresh test database';
  assert (select count(*) from public.categories) = 6, 'Six categories must be seeded';
  assert (select count(*) from pg_class as c join pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname in ('categories', 'articles', 'comments', 'profiles')
    and c.relrowsecurity) = 4, 'All application tables need RLS';
end;
$$;

insert into auth.users (id) values
  ('00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000002');
insert into public.profiles (id, display_name) values
  ('00000000-0000-4000-8000-000000000001', 'Test administrator');
insert into public.articles (id, title, slug, excerpt, content, status) values
  ('10000000-0000-4000-8000-000000000001', 'Published', 'test-published', 'Excerpt', 'Body', 'published'),
  ('10000000-0000-4000-8000-000000000002', 'Draft', 'test-draft', 'Excerpt', 'Body', 'draft'),
  ('10000000-0000-4000-8000-000000000003', 'Archived', 'test-archived', 'Excerpt', 'Body', 'archived');
insert into public.comments (article_id, name, email, content, status) values
  ('10000000-0000-4000-8000-000000000001', 'Approved reader', 'approved@example.invalid', 'Approved body', 'approved'),
  ('10000000-0000-4000-8000-000000000001', 'Waiting reader', 'waiting@example.invalid', 'Pending body', 'pending'),
  ('10000000-0000-4000-8000-000000000001', 'Rejected reader', 'rejected@example.invalid', 'Rejected body', 'rejected'),
  ('10000000-0000-4000-8000-000000000002', 'Hidden reader', 'hidden@example.invalid', 'Draft discussion', 'approved');

do $$
begin
  begin
    insert into public.profiles (id, display_name) values
      ('00000000-0000-4000-8000-000000000002', 'Second admin');
    raise exception 'Second administrator was allowed';
  exception when unique_violation then null;
  end;
  begin
    insert into public.profiles (id, display_name, role) values
      ('00000000-0000-4000-8000-000000000002', 'Other role', 'member');
    raise exception 'Unsupported profile role was allowed';
  exception when check_violation then null;
  end;
  begin
    update public.articles set status = 'invalid' where slug = 'test-draft';
    raise exception 'Invalid article status was allowed';
  exception when check_violation then null;
  end;
  begin
    update public.comments set status = 'invalid' where name = 'Waiting reader';
    raise exception 'Invalid comment status was allowed';
  exception when check_violation then null;
  end;
  begin
    update public.articles set reading_time = 0 where slug = 'test-draft';
    raise exception 'Non-positive reading time was allowed';
  exception when check_violation then null;
  end;
  assert (select published_at is not null from public.articles where slug = 'test-published'),
    'Publishing should fill published_at';
end;
$$;

-- Anonymous readers: no identity, no mutation privileges except pending comments.
set local role anon;
set local request.jwt.claim.sub = '';
set local request.jwt.claims = '{"role":"anon"}';
do $$
begin
  assert (select count(*) from public.categories) = 6, 'Categories should be public';
  assert (select count(*) from public.articles) = 1, 'Drafts and archives leaked';
  assert (select count(id) from public.comments) = 1, 'Unapproved or draft-article comments leaked';
  begin
    perform email from public.comments;
    raise exception 'Private commenter emails leaked';
  exception when insufficient_privilege then null;
  end;
  begin
    perform id from public.profiles;
    raise exception 'Profiles were publicly readable';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.get_admin_comments();
    raise exception 'Anonymous moderation access allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.articles (title, slug, excerpt, content) values ('No', 'no', 'No', 'No');
    raise exception 'Anonymous article insert allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.articles set title = 'Changed';
    raise exception 'Anonymous article update allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.articles;
    raise exception 'Anonymous article deletion allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.categories (name, slug) values ('No', 'no');
    raise exception 'Anonymous category creation allowed';
  exception when insufficient_privilege then null;
  end;
  insert into public.comments (article_id, name, email, content) values
    ('10000000-0000-4000-8000-000000000001', 'Guest', 'guest@example.invalid', 'New pending comment');
  assert (select count(id) from public.comments) = 1, 'Pending submission became public';
  begin
    insert into public.comments (article_id, name, email, content, status) values
      ('10000000-0000-4000-8000-000000000001', 'Forged', 'test@example.invalid', 'Forged', 'approved');
    raise exception 'Caller supplied a moderation status';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.comments (article_id, name, email, content) values
      ('10000000-0000-4000-8000-000000000002', 'No', 'test@example.invalid', 'Draft comment');
    raise exception 'Comment on draft allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.comments (article_id, name, email, content) values
      ('10000000-0000-4000-8000-000000000003', 'No', 'test@example.invalid', 'Archived comment');
    raise exception 'Comment on archive allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.comments set status = 'approved';
    raise exception 'Anonymous comment moderation allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.comments;
    raise exception 'Anonymous comment deletion allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.profiles (id, display_name) values
      ('00000000-0000-4000-8000-000000000002', 'Self-appointed');
    raise exception 'Anonymous admin creation allowed';
  exception when insufficient_privilege then null;
  end;
end;
$$;

-- An ordinary Auth account must have no more powers than a public reader.
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000002';
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000002","user_metadata":{"role":"admin"}}';
do $$
declare affected integer;
begin
  assert not journal_private.is_admin(), 'User metadata incorrectly granted admin';
  assert (select count(*) from public.profiles) = 0, 'Another profile leaked';
  assert (select count(*) from public.articles) = 1, 'Private articles leaked to a non-admin';
  assert (select count(id) from public.comments) = 1, 'Private comments leaked to a non-admin';
  begin
    perform public.get_admin_comments();
    raise exception 'Non-admin moderation access allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.articles (title, slug, excerpt, content) values ('No', 'no', 'No', 'No');
    raise exception 'Non-admin article creation allowed';
  exception when insufficient_privilege then null;
  end;
  update public.articles set title = 'Tampered';
  get diagnostics affected = row_count;
  assert affected = 0, 'Non-admin changed an article';
  delete from public.articles;
  get diagnostics affected = row_count;
  assert affected = 0, 'Non-admin deleted an article';
  update public.categories set name = 'Tampered';
  get diagnostics affected = row_count;
  assert affected = 0, 'Non-admin changed a category';
  delete from public.categories;
  get diagnostics affected = row_count;
  assert affected = 0, 'Non-admin deleted a category';
  update public.comments set status = 'rejected';
  get diagnostics affected = row_count;
  assert affected = 0, 'Non-admin moderated a comment';
  delete from public.comments;
  get diagnostics affected = row_count;
  assert affected = 0, 'Non-admin deleted a comment';
  begin
    insert into public.profiles (id, display_name) values
      ('00000000-0000-4000-8000-000000000002', 'Self-appointed');
    raise exception 'Authenticated self-promotion allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.profiles set role = 'admin';
    raise exception 'Profile role modification allowed';
  exception when insufficient_privilege then null;
  end;
end;
$$;

-- The single profile-backed administrator can perform the required operations.
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001"}';
do $$
declare new_category uuid; new_article uuid; new_comment uuid; affected integer;
begin
  assert journal_private.is_admin(), 'Provisioned administrator not recognized';
  assert (select count(*) from public.profiles) = 1, 'Admin cannot read own profile';
  assert (select count(*) from public.articles) = 3, 'Admin cannot read all article states';
  assert (select count(id) from public.comments) = 5, 'Admin cannot read all comment states';
  assert (select count(*) from public.get_admin_comments()) = 5, 'Admin moderation RPC incomplete';
  assert exists (select 1 from public.get_admin_comments() where email = 'guest@example.invalid'),
    'Admin cannot read private email via moderation RPC';
  begin
    perform public.get_admin_comments(101, 0);
    raise exception 'Unbounded moderation page allowed';
  exception when invalid_parameter_value then null;
  end;
  insert into public.categories (name, slug) values ('Test category', 'test-category') returning id into new_category;
  update public.categories set name = 'Renamed category' where id = new_category;
  assert (select name from public.categories where id = new_category) = 'Renamed category', 'Category edit failed';
  insert into public.articles (title, slug, excerpt, content, category_id)
    values ('Admin created', 'admin-created', 'Excerpt', 'Body', new_category) returning id into new_article;
  assert (select status from public.articles where id = new_article) = 'draft', 'Default must be draft';
  update public.articles set title = 'Edited', status = 'published', updated_at = '2000-01-01' where id = new_article;
  assert (select published_at is not null and updated_at > '2000-01-01'::timestamptz
    and title = 'Edited' from public.articles where id = new_article), 'Publishing or timestamps failed';
  insert into public.comments (article_id, name, email, content)
    values (new_article, 'Admin comment', 'test@example.invalid', 'Cascade fixture') returning id into new_comment;
  begin
    delete from public.categories where id = new_category;
    raise exception 'Used category deletion was allowed';
  exception when foreign_key_violation then null;
  end;
  assert (select category_id = new_category from public.articles where id = new_article), 'Used category must be preserved';
  update public.articles set status = 'archived' where id = new_article;
  assert (select status from public.articles where id = new_article) = 'archived', 'Archive failed';
  delete from public.articles where id = new_article;
  assert not exists (select 1 from public.comments where id = new_comment), 'Comment cascade failed';
  delete from public.categories where id = new_category;
  assert not exists (select 1 from public.categories where id = new_category), 'Unused category deletion failed';
  update public.comments set status = 'approved' where name = 'Waiting reader';
  get diagnostics affected = row_count;
  assert affected = 1, 'Comment approval failed';
  update public.comments set status = 'rejected' where name = 'Waiting reader';
  get diagnostics affected = row_count;
  assert affected = 1, 'Comment rejection failed';
  delete from public.comments where name = 'Rejected reader';
  get diagnostics affected = row_count;
  assert affected = 1, 'Comment deletion failed';
  begin
    insert into public.profiles (id, display_name) values
      ('00000000-0000-4000-8000-000000000002', 'Second administrator');
    raise exception 'Admin could grant another account a profile through the API';
  exception when insufficient_privilege then null;
  end;
end;
$$;

-- Auth deletion removes the profile and revokes admin powers immediately.
reset role;
do $$
begin
  assert (select status from public.comments where name = 'Guest') = 'pending', 'Public insert did not default to pending';
  delete from auth.users where id = '00000000-0000-4000-8000-000000000001';
  assert (select count(*) from public.profiles) = 0, 'Auth deletion did not cascade';
end;
$$;
set local role authenticated;
do $$
begin
  assert not journal_private.is_admin(), 'Deleted administrator retained access';
  assert (select count(*) from public.articles) = 1, 'Deleted administrator can read drafts';
  begin
    perform public.get_admin_comments();
    raise exception 'Deleted administrator retained moderation access';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
rollback;
-- Reaching this line without an error means every assertion passed.
