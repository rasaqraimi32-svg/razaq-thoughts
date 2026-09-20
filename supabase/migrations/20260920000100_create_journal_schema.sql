-- Initial application schema. Apply through the Supabase migration runner.
-- Auth users are managed by Supabase; this migration does not create any user.
begin;

create schema journal_private;
revoke all on schema journal_private from public, anon, authenticated;
grant usage on schema journal_private to authenticated;

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default now(),
  constraint categories_name_not_blank check (length(btrim(name)) > 0),
  constraint categories_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

create table public.articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text not null,
  content text not null,
  category_id uuid references public.categories(id) on delete set null,
  author_name text not null default 'The Insight Journal',
  status text not null default 'draft',
  featured boolean not null default false,
  reading_time integer,
  cover_image_url text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint articles_title_not_blank check (length(btrim(title)) > 0),
  constraint articles_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint articles_excerpt_not_blank check (length(btrim(excerpt)) > 0),
  constraint articles_content_not_blank check (length(btrim(content)) > 0),
  constraint articles_author_not_blank check (length(btrim(author_name)) > 0),
  constraint articles_status_check check (status in ('draft', 'published', 'archived')),
  constraint articles_reading_time_positive check (reading_time is null or reading_time > 0)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  name text not null,
  email text not null,
  content text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  constraint comments_name_not_blank check (length(btrim(name)) > 0),
  constraint comments_email_not_blank check (length(btrim(email)) > 0),
  constraint comments_content_not_blank check (length(btrim(content)) > 0),
  constraint comments_status_check check (status in ('pending', 'approved', 'rejected'))
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null default 'admin',
  created_at timestamptz not null default now(),
  constraint profiles_display_name_not_blank check (length(btrim(display_name)) > 0),
  constraint profiles_admin_role_only check (role = 'admin')
);

-- NOT NULL + the admin-only role check + this unique index allow at most one
-- profile, including under concurrent inserts. It must be provisioned privately.
create unique index profiles_single_admin_idx on public.profiles (role);

-- UNIQUE constraints already create indexes for category name/slug and article slug.
create index articles_status_idx on public.articles (status);
create index articles_category_id_idx on public.articles (category_id);
create index articles_published_at_idx on public.articles (published_at desc);
create index comments_article_id_idx on public.comments (article_id);
create index comments_status_idx on public.comments (status);
create index comments_created_at_idx on public.comments (created_at desc);

create function journal_private.set_article_timestamps()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

revoke all on function journal_private.set_article_timestamps() from public, anon, authenticated;

create trigger articles_set_timestamps
before insert or update on public.articles
for each row execute function journal_private.set_article_timestamps();

-- The owner checks the private profile without recursive profile RLS evaluation.
-- No user-controlled identifier, role metadata, or dynamic SQL is trusted here.
create function journal_private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as profile
    where profile.id = (select auth.uid())
      and profile.role = 'admin'
  );
$$;

revoke all on function journal_private.is_admin() from public, anon, authenticated;
grant execute on function journal_private.is_admin() to authenticated;

alter table public.categories enable row level security;
alter table public.articles enable row level security;
alter table public.comments enable row level security;
alter table public.profiles enable row level security;

-- Remove Supabase's default API privileges before granting the minimum needed.
-- The service role is a trusted backend role; no service key is used by the app.
revoke all on table public.categories, public.articles, public.comments, public.profiles
  from public, anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on table public.categories, public.articles to anon, authenticated;
grant insert, update, delete on table public.categories, public.articles to authenticated;
grant select on table public.profiles to authenticated;
grant all on table public.categories, public.articles, public.comments, public.profiles to service_role;

-- Email is private even for approved comments. Public queries must select these
-- explicit columns, not '*'. Admins use get_admin_comments() for full records.
grant select (id, article_id, name, content, status, created_at)
  on public.comments to anon, authenticated;
-- Omitting status makes the database default authoritative: submissions are pending.
-- Callers cannot supply an id, timestamp, or moderation status.
grant insert (article_id, name, email, content)
  on public.comments to anon, authenticated;
grant update (status) on public.comments to authenticated;
grant delete on public.comments to authenticated;

create policy categories_public_read on public.categories
  for select to anon, authenticated using (true);
create policy categories_admin_insert on public.categories
  for insert to authenticated with check ((select journal_private.is_admin()));
create policy categories_admin_update on public.categories
  for update to authenticated
  using ((select journal_private.is_admin()))
  with check ((select journal_private.is_admin()));
create policy categories_admin_delete on public.categories
  for delete to authenticated using ((select journal_private.is_admin()));

create policy articles_public_read on public.articles
  for select to anon, authenticated using (status = 'published');
create policy articles_admin_read on public.articles
  for select to authenticated using ((select journal_private.is_admin()));
create policy articles_admin_insert on public.articles
  for insert to authenticated with check ((select journal_private.is_admin()));
create policy articles_admin_update on public.articles
  for update to authenticated
  using ((select journal_private.is_admin()))
  with check ((select journal_private.is_admin()));
create policy articles_admin_delete on public.articles
  for delete to authenticated using ((select journal_private.is_admin()));

-- Approved comments disappear from public reads if their article is unpublished.
create policy comments_public_read on public.comments
  for select to anon, authenticated
  using (
    status = 'approved'
    and exists (
      select 1 from public.articles as article
      where article.id = comments.article_id and article.status = 'published'
    )
  );
create policy comments_public_insert on public.comments
  for insert to anon, authenticated
  with check (
    status = 'pending'
    and exists (
      select 1 from public.articles as article
      where article.id = comments.article_id and article.status = 'published'
    )
  );
create policy comments_admin_read on public.comments
  for select to authenticated using ((select journal_private.is_admin()));
create policy comments_admin_update on public.comments
  for update to authenticated
  using ((select journal_private.is_admin()))
  with check ((select journal_private.is_admin()));
create policy comments_admin_delete on public.comments
  for delete to authenticated using ((select journal_private.is_admin()));

-- There are deliberately no API INSERT, UPDATE, or DELETE policies for profiles.
-- Even the administrator cannot grant another account a role through the API.
create policy profiles_admin_read_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) and role = 'admin');

-- Column privileges cannot vary by authenticated user's identity. This narrowly
-- scoped RPC provides the sole admin with full moderation records, including email.
create function public.get_admin_comments(
  p_limit integer default 50,
  p_offset integer default 0
)
returns setof public.comments
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not journal_private.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100
    or p_offset is null or p_offset < 0 then
    raise exception 'Invalid pagination parameters' using errcode = '22023';
  end if;
  return query
    select comment.* from public.comments as comment
    order by comment.created_at desc, comment.id
    limit p_limit offset p_offset;
end;
$$;

revoke all on function public.get_admin_comments(integer, integer) from public, anon, authenticated;
grant execute on function public.get_admin_comments(integer, integer) to authenticated;

insert into public.categories (name, slug) values
  ('Philosophy', 'philosophy'),
  ('Education', 'education'),
  ('Technology', 'technology'),
  ('Society', 'society'),
  ('Culture', 'culture'),
  ('Development', 'development');

comment on table public.profiles is 'Single administrator, privately provisioned against an existing Supabase Auth user; never created from signup metadata.';
comment on column public.comments.email is 'Private contact data. Not selectable by public API roles; available to the administrator through get_admin_comments.';
comment on function public.get_admin_comments(integer, integer) is 'Admin-only paginated moderation read, including private email; verifies the caller against profiles.';

commit;
