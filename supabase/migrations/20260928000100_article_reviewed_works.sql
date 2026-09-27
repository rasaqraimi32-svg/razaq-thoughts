-- Optional original works reviewed by articles. PDFs are NOT article cover images.
begin;
create table public.article_reviewed_works (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null unique references public.articles(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 300),
  author_name text not null check (length(btrim(author_name)) between 1 and 200),
  pdf_storage_path text not null unique,
  pdf_original_filename text not null check (length(pdf_original_filename) between 5 and 180),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reviewed_pdf_path check (
    pdf_storage_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$'
    and split_part(pdf_storage_path, '/', 1) = article_id::text
  )
);
create function journal_private.set_reviewed_work_timestamp()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
revoke all on function journal_private.set_reviewed_work_timestamp() from public, anon, authenticated;
create trigger reviewed_work_timestamp before update on public.article_reviewed_works
for each row execute function journal_private.set_reviewed_work_timestamp();

alter table public.article_reviewed_works enable row level security;
revoke all on public.article_reviewed_works from public, anon, authenticated;
grant select on public.article_reviewed_works to anon, authenticated;
grant insert, update, delete on public.article_reviewed_works to authenticated;
grant all on public.article_reviewed_works to service_role;
create policy reviewed_works_public_read on public.article_reviewed_works
for select to anon, authenticated using (exists (
  select 1 from public.articles a where a.id = article_id and a.status = 'published'
));
create policy reviewed_works_admin_read on public.article_reviewed_works
for select to authenticated using ((select journal_private.is_admin()));
create policy reviewed_works_admin_insert on public.article_reviewed_works
for insert to authenticated with check ((select journal_private.is_admin()));
create policy reviewed_works_admin_update on public.article_reviewed_works
for update to authenticated using ((select journal_private.is_admin())) with check ((select journal_private.is_admin()));
create policy reviewed_works_admin_delete on public.article_reviewed_works
for delete to authenticated using ((select journal_private.is_admin()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('article-reviewed-pdfs', 'article-reviewed-pdfs', false, 3145728, array['application/pdf'])
on conflict (id) do update set public = false,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
create policy reviewed_pdfs_public_read on storage.objects
for select to anon, authenticated using (
  bucket_id = 'article-reviewed-pdfs' and exists (
    select 1 from public.article_reviewed_works w join public.articles a on a.id = w.article_id
    where w.pdf_storage_path = storage.objects.name and a.status = 'published'
  )
);
create policy reviewed_pdfs_admin_read on storage.objects
for select to authenticated using (bucket_id = 'article-reviewed-pdfs' and (select journal_private.is_admin()));
create policy reviewed_pdfs_admin_insert on storage.objects
for insert to authenticated with check (
  bucket_id = 'article-reviewed-pdfs' and (select journal_private.is_admin())
  and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$'
  and exists (select 1 from public.articles a where a.id::text = split_part(name, '/', 1))
);
create policy reviewed_pdfs_admin_delete_unused on storage.objects
for delete to authenticated using (
  bucket_id = 'article-reviewed-pdfs' and (select journal_private.is_admin())
  and not exists (select 1 from public.article_reviewed_works w where w.pdf_storage_path = storage.objects.name)
);
-- No UPDATE/upsert: replacements always use new UUID paths.
-- Defense against unrelated broad read policies: never expose unpublished PDFs.
create policy reviewed_pdfs_anon_read_guard on storage.objects as restrictive
for select to anon using (bucket_id <> 'article-reviewed-pdfs' or exists (
  select 1 from public.article_reviewed_works w join public.articles a on a.id = w.article_id
  where w.pdf_storage_path = storage.objects.name and a.status = 'published'
));
create policy reviewed_pdfs_authenticated_read_guard on storage.objects as restrictive
for select to authenticated using (bucket_id <> 'article-reviewed-pdfs' or (select journal_private.is_admin()) or exists (
  select 1 from public.article_reviewed_works w join public.articles a on a.id = w.article_id
  where w.pdf_storage_path = storage.objects.name and a.status = 'published'
));


-- Restrictive write guards prevent unrelated broad Storage policies from granting
-- writes to this bucket. They evaluate to true for every other bucket.
create policy reviewed_pdfs_anon_insert_guard on storage.objects as restrictive
for insert to anon with check (bucket_id <> 'article-reviewed-pdfs');
create policy reviewed_pdfs_anon_delete_guard on storage.objects as restrictive
for delete to anon using (bucket_id <> 'article-reviewed-pdfs');
create policy reviewed_pdfs_no_overwrite on storage.objects as restrictive
for update to anon, authenticated using (bucket_id <> 'article-reviewed-pdfs') with check (bucket_id <> 'article-reviewed-pdfs');
create policy reviewed_pdfs_insert_guard on storage.objects as restrictive
for insert to authenticated with check (bucket_id <> 'article-reviewed-pdfs' or (
  (select journal_private.is_admin())
  and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$'
  and exists (select 1 from public.articles a where a.id::text = split_part(name, '/', 1))
));
create policy reviewed_pdfs_delete_guard on storage.objects as restrictive
for delete to authenticated using (bucket_id <> 'article-reviewed-pdfs' or (
  (select journal_private.is_admin())
  and not exists (select 1 from public.article_reviewed_works w where w.pdf_storage_path = storage.objects.name)
));

-- Recovery after interrupted requests / article cascade deletion. No privileged key.
create function public.get_unused_reviewed_pdf_paths()
returns table (path text) language plpgsql security invoker set search_path = '' as $$
begin
  if not journal_private.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  return query select o.name from storage.objects o
    where o.bucket_id = 'article-reviewed-pdfs' and o.created_at < now() - interval '24 hours'
      and not exists (select 1 from public.article_reviewed_works w where w.pdf_storage_path = o.name)
    order by o.created_at, o.name limit 100;
end;
$$;
revoke all on function public.get_unused_reviewed_pdf_paths() from public, anon, authenticated;
grant execute on function public.get_unused_reviewed_pdf_paths() to authenticated;
commit;
