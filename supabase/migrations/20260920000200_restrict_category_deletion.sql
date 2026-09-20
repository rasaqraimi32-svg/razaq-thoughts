-- Prevent deleting categories referenced by any article, including concurrent writes.
-- Re-running this transaction safely recreates the same foreign key.
begin;
alter table public.articles
  drop constraint articles_category_id_fkey;
alter table public.articles
  add constraint articles_category_id_fkey
  foreign key (category_id) references public.categories(id) on delete restrict;
commit;
