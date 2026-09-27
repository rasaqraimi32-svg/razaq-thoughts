-- Cover images are public assets, even when attached to a draft.
-- No article schema, article RLS or auth changes. Only this bucket is affected.
begin;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('article-covers', 'article-covers', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy article_covers_admin_read on storage.objects
for select to authenticated using (
  bucket_id = 'article-covers' and (select journal_private.is_admin())
);
create policy article_covers_admin_insert on storage.objects
for insert to authenticated with check (
  bucket_id = 'article-covers' and (select journal_private.is_admin())
  and name ~ '^uploads/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
);
-- Replacements use fresh UUID paths, never overwrite existing bytes.
-- SELECT is also required by the Storage deletion API.
create policy article_covers_admin_delete_unused on storage.objects
for delete to authenticated using (
  bucket_id = 'article-covers' and (select journal_private.is_admin())
  and not exists (
    select 1 from public.articles as article
    where right(article.cover_image_url, length('/storage/v1/object/public/article-covers/' || name))
      = '/storage/v1/object/public/article-covers/' || name
  )
);
-- No public INSERT/UPDATE/DELETE and no UPDATE policy (upsert is unnecessary).
commit;
