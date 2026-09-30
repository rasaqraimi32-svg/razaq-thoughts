-- Private provenance only; existing comments columns, grants and RLS stay intact.
begin;
create table journal_private.comment_simulation_batches (
 article_id uuid primary key references public.articles(id) on delete cascade,
 batch_id uuid not null unique default gen_random_uuid(),
 created_at timestamptz not null default now()
);
create table journal_private.comment_simulation_entries (
 comment_id uuid primary key references public.comments(id) on delete cascade,
 article_id uuid not null references journal_private.comment_simulation_batches(article_id) on delete cascade
);
alter table journal_private.comment_simulation_batches enable row level security;
alter table journal_private.comment_simulation_entries enable row level security;
revoke all on journal_private.comment_simulation_batches, journal_private.comment_simulation_entries from public, anon, authenticated;

create function public.comment_simulation_snapshot()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
 if not journal_private.is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
 select jsonb_build_object(
  'count', (select count(*) from journal_private.comment_simulation_entries),
  'articleIds', coalesce((select jsonb_agg(article_id order by article_id) from journal_private.comment_simulation_batches), '[]'::jsonb),
  'token', md5(coalesce((select string_agg(batch_id::text, ',' order by batch_id) from journal_private.comment_simulation_batches),'') || ':' || coalesce((select string_agg(comment_id::text, ',' order by comment_id) from journal_private.comment_simulation_entries),''))
 ) into result;
 return result;
end $$;

create function public.seed_comment_simulation(p_article_id uuid, p_updated_at timestamptz, p_comments jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare item jsonb; new_id uuid; batch uuid; article public.articles; n integer; idx integer := 0;
begin
 if not journal_private.is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
 -- Shared transaction lock also serializes cleanup. Unique article PK is a second safeguard.
 perform pg_advisory_xact_lock(193576483, 3001);
 if exists(select 1 from journal_private.comment_simulation_batches where article_id=p_article_id) then
  return jsonb_build_object('status','skipped','count',0);
 end if;
 select * into article from public.articles where id=p_article_id for share;
 if not found or article.status <> 'published' then raise exception 'Article is no longer published' using errcode='22023'; end if;
 if p_updated_at is distinct from article.updated_at then raise exception 'Article changed; reload before seeding' using errcode='22023'; end if;
 if jsonb_typeof(p_comments) is distinct from 'array' then raise exception 'Invalid comments' using errcode='22023'; end if;
 n := jsonb_array_length(p_comments);
 if n < 15 or n > 25 then raise exception 'Expected 15 to 25 comments' using errcode='22023'; end if;
 if (select count(distinct lower(value->>'name')) from jsonb_array_elements(p_comments)) <> n
 or (select count(distinct value->>'content') from jsonb_array_elements(p_comments)) <> n then
  raise exception 'Duplicate names or content' using errcode='22023';
 end if;
 insert into journal_private.comment_simulation_batches(article_id) values(p_article_id) returning batch_id into batch;
 for item in select value from jsonb_array_elements(p_comments) loop
  if jsonb_typeof(item->'name') is distinct from 'string' or jsonb_typeof(item->'content') is distinct from 'string'
   or (item->>'name') !~ '^[[:alpha:]]{2,40}$'
   or lower(item->>'name') in ('mr','mrs','ms','dr','prof','sir','reader','user','anonymous')
   or length(btrim(item->>'content')) not between 20 and 2000 then
   raise exception 'Invalid simulated comment' using errcode='22023';
  end if;
  idx := idx + 1;
  insert into public.comments(article_id,name,email,content,status)
   values(p_article_id,item->>'name','simulation.' || batch::text || '.' || idx::text || '@example.com',item->>'content','approved') returning id into new_id;
  insert into journal_private.comment_simulation_entries(comment_id,article_id) values(new_id,p_article_id);
 end loop;
 return jsonb_build_object('status','seeded','count',n);
end $$;

create function public.remove_comment_simulation(p_token text, p_confirm boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare snapshot jsonb; removed integer;
begin
 if not journal_private.is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
 if p_confirm is distinct from true then raise exception 'Confirmation required' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(193576483, 3001);
 snapshot := public.comment_simulation_snapshot();
 if p_token is distinct from snapshot->>'token' then raise exception 'Simulation changed; preview cleanup again' using errcode='22023'; end if;
 delete from public.comments c using journal_private.comment_simulation_entries e where c.id=e.comment_id;
 get diagnostics removed = row_count;
 delete from journal_private.comment_simulation_batches;
 return jsonb_build_object('removed',removed,'remaining',(select count(*) from journal_private.comment_simulation_entries),'errors',0);
end $$;

revoke all on function public.comment_simulation_snapshot() from public, anon, authenticated;
revoke all on function public.seed_comment_simulation(uuid,timestamptz,jsonb) from public, anon, authenticated;
revoke all on function public.remove_comment_simulation(text,boolean) from public, anon, authenticated;
grant execute on function public.comment_simulation_snapshot() to authenticated;
grant execute on function public.seed_comment_simulation(uuid,timestamptz,jsonb) to authenticated;
grant execute on function public.remove_comment_simulation(text,boolean) to authenticated;
commit;
