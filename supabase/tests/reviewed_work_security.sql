-- Disposable local Supabase only. Apply all migrations first. Never run on production.
-- SQL metadata fixtures only; no real Storage bytes. Everything is rolled back.
begin;
set local plpgsql.check_asserts = on;
set local storage.allow_delete_query = 'true';
do $$ begin
  assert (select count(*) from public.profiles) = 0, 'Use a fresh disposable database';
  assert (select count(*) from public.articles) = 0, 'Use a fresh disposable database';
  assert (select count(*) from public.article_reviewed_works) = 0, 'Use a fresh disposable database';
  assert (select not public and file_size_limit = 3145728 and allowed_mime_types = array['application/pdf'] from storage.buckets where id = 'article-reviewed-pdfs'), 'Private PDF bucket configuration';
end; $$;
insert into auth.users(id) values ('00000000-0000-4000-8000-000000000001'), ('00000000-0000-4000-8000-000000000002');
insert into public.profiles(id, display_name) values ('00000000-0000-4000-8000-000000000001', 'Test admin');
insert into public.articles(id, title, slug, excerpt, content, status) values
('10000000-0000-4000-8000-000000000001', 'Published', 'pdf-published', 'Excerpt', 'Body', 'published'),
('10000000-0000-4000-8000-000000000002', 'Draft', 'pdf-draft', 'Excerpt', 'Body', 'draft');
insert into storage.objects(bucket_id, name) values
('article-reviewed-pdfs', '10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000001.pdf'),
('article-reviewed-pdfs', '10000000-0000-4000-8000-000000000002/20000000-0000-4000-8000-000000000002.pdf');
insert into public.article_reviewed_works(article_id, title, author_name, pdf_storage_path, pdf_original_filename) values
('10000000-0000-4000-8000-000000000001', 'Original public work', 'Original author', '10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000001.pdf', 'source.pdf'),
('10000000-0000-4000-8000-000000000002', 'Original private work', 'Original author', '10000000-0000-4000-8000-000000000002/20000000-0000-4000-8000-000000000002.pdf', 'private.pdf');
-- Prove unrelated permissive Storage policies cannot bypass PDF guards.
create policy reviewed_pdf_test_permissive on storage.objects for all to anon, authenticated using (true) with check (true);
set local role anon;
set local request.jwt.claim.sub = '';
set local request.jwt.claims = '{"role":"anon"}';
do $$ declare affected integer; begin
  assert (select count(*) from public.article_reviewed_works) = 1, 'Only published work is readable';
  assert (select count(*) from storage.objects where bucket_id = 'article-reviewed-pdfs') = 1, 'Unpublished file metadata leaked';
  begin
    insert into storage.objects(bucket_id, name) values ('article-reviewed-pdfs', '10000000-0000-4000-8000-000000000001/30000000-0000-4000-8000-000000000001.pdf');
    raise exception 'Anonymous upload allowed';
  exception when insufficient_privilege then null; end;
  delete from storage.objects where bucket_id = 'article-reviewed-pdfs';
  get diagnostics affected = row_count; assert affected = 0, 'Anonymous deletion allowed';
end; $$;
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000002';
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000002"}';
do $$ declare affected integer; begin
  assert (select count(*) from public.article_reviewed_works) = 1, 'Draft bibliography leaked';
  assert (select count(*) from storage.objects where bucket_id = 'article-reviewed-pdfs') = 1, 'Draft PDF leaked';
  begin
    insert into storage.objects(bucket_id, name) values ('article-reviewed-pdfs', '10000000-0000-4000-8000-000000000001/30000000-0000-4000-8000-000000000001.pdf');
    raise exception 'Non-admin upload allowed';
  exception when insufficient_privilege then null; end;
  update public.article_reviewed_works set title = 'Tampered';
  get diagnostics affected = row_count; assert affected = 0, 'Non-admin changed bibliography';
  delete from storage.objects where bucket_id = 'article-reviewed-pdfs';
  get diagnostics affected = row_count; assert affected = 0, 'Non-admin deleted PDF';
  begin perform public.get_unused_reviewed_pdf_paths(); raise exception 'Non-admin cleanup allowed';
  exception when insufficient_privilege then null; end;
end; $$;
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001"}';
do $$ declare affected integer; begin
  assert (select count(*) from public.article_reviewed_works) = 2, 'Admin needs draft access';
  assert (select count(*) from storage.objects where bucket_id = 'article-reviewed-pdfs') = 2, 'Admin needs draft PDF access';
  insert into storage.objects(bucket_id, name) values ('article-reviewed-pdfs', '10000000-0000-4000-8000-000000000001/30000000-0000-4000-8000-000000000001.pdf');
  update storage.objects set name = 'overwrite.pdf' where bucket_id = 'article-reviewed-pdfs';
  get diagnostics affected = row_count; assert affected = 0, 'PDFs must not be overwritten';
  delete from storage.objects where bucket_id = 'article-reviewed-pdfs';
  get diagnostics affected = row_count; assert affected = 1, 'Only the unreferenced PDF may be removed';
  begin
    insert into public.article_reviewed_works(article_id, title, author_name, pdf_storage_path, pdf_original_filename) values
    ('10000000-0000-4000-8000-000000000001', 'Duplicate', 'Writer', '10000000-0000-4000-8000-000000000001/40000000-0000-4000-8000-000000000001.pdf', 'duplicate.pdf');
    raise exception 'Multiple works per article allowed';
  exception when unique_violation then null; end;
  update public.articles set status = 'draft' where slug = 'pdf-published';
end; $$;
reset role;
set local role anon;
set local request.jwt.claim.sub = '';
set local request.jwt.claims = '{"role":"anon"}';
do $$ begin
  assert (select count(*) from public.article_reviewed_works) = 0, 'Unpublishing must hide reviewed work';
  assert (select count(*) from storage.objects where bucket_id = 'article-reviewed-pdfs') = 0, 'Unpublishing must hide PDF';
end; $$;
reset role;
delete from public.articles where slug = 'pdf-draft';
do $$ begin assert (select count(*) from public.article_reviewed_works) = 1, 'Article deletion must cascade bibliography'; end; $$;
rollback;
