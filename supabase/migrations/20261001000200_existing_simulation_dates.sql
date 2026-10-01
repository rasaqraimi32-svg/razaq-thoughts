-- Capabilities only. No existing comments or ledger records are changed by this migration.
begin;
create table journal_private.comment_simulation_date_previews (
 id uuid primary key default gen_random_uuid(),
 administrator_id uuid not null references auth.users(id) on delete cascade,
 source jsonb not null,
 plan jsonb not null,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now() + interval '24 hours',
 consumed_at timestamptz
);
alter table journal_private.comment_simulation_date_previews enable row level security;
revoke all on journal_private.comment_simulation_date_previews from public, anon, authenticated;

-- Full values, not just IDs: stale timestamps, ownership or content invalidate a preview.
create function journal_private.simulation_date_source()
returns jsonb language sql stable set search_path = '' as $$
 select jsonb_build_object(
  'batches',coalesce((select jsonb_agg(to_jsonb(b) order by b.article_id) from journal_private.comment_simulation_batches b),'[]'::jsonb),
  'entries',coalesce((select jsonb_agg(to_jsonb(e) order by e.comment_id) from journal_private.comment_simulation_entries e),'[]'::jsonb),
  'comments',coalesce((select jsonb_agg(to_jsonb(c) order by c.id) from public.comments c join journal_private.comment_simulation_entries e on e.comment_id=c.id),'[]'::jsonb),
  'articles',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'title',a.title) order by a.id) from public.articles a join journal_private.comment_simulation_batches b on b.article_id=a.id),'[]'::jsonb)
 )
$$;
revoke all on function journal_private.simulation_date_source() from public, anon, authenticated;

create function public.prepare_existing_simulation_dates()
returns jsonb language plpgsql security definer set search_path = '' set timezone = 'UTC' as $$
declare source jsonb; plan jsonb := '[]'; article record; item record;
 n integer; day_index integer; slot integer; daily integer; fourth integer[];
 dates timestamptz[]; used_dates timestamptz[] := array[]::timestamptz[];
 stamp timestamptz; index integer; comments jsonb; days jsonb; preview_id uuid; expiry timestamptz;
begin
 if not journal_private.is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(193576483,3001);
 lock table public.articles, public.comments, journal_private.comment_simulation_batches, journal_private.comment_simulation_entries in share mode;
 source := journal_private.simulation_date_source();
 if exists(select 1 from journal_private.comment_simulation_entries e left join public.comments c on c.id=e.comment_id where c.id is null or c.article_id<>e.article_id) then
  raise exception 'Simulation ledger ownership mismatch' using errcode='22023';
 end if;
 for article in select a.id,a.title from public.articles a join journal_private.comment_simulation_batches b on b.article_id=a.id order by a.id loop
  select count(*) into n from journal_private.comment_simulation_entries where article_id=article.id;
  if n not between 18 and 24 then
   plan := plan || jsonb_build_array(jsonb_build_object('articleId',article.id,'title',article.title,'count',n,'status','incompatible','days','[]'::jsonb,'comments','[]'::jsonb));
   continue;
  end if;
  select coalesce(array_agg(d),array[]::integer[]) into fourth from (select d from generate_series(0,5) d order by random() limit n-18) chosen;
  dates := array[]::timestamptz[]; days := '[]';
  for day_index in 0..5 loop
   daily := 3 + case when day_index=any(fourth) then 1 else 0 end;
   days := days || jsonb_build_array(jsonb_build_object('date',to_char(date '2026-09-25'+day_index,'YYYY-MM-DD'),'count',daily));
   for slot in 0..daily-1 loop
    -- Disjoint slots span 07:00–22:00 UTC; millisecond precision matches the UI.
    loop
     stamp := timestamptz '2026-09-25 07:00:00+00' + day_index*interval '1 day'
       + (slot*(54000000/daily)+floor(random()*(54000000/daily)))*interval '1 millisecond';
     exit when not(stamp=any(used_dates)) and not exists(select 1 from public.comments where created_at=stamp);
    end loop;
    dates := array_append(dates,stamp); used_dates := array_append(used_dates,stamp);
   end loop;
  end loop;
  index := 0; comments := '[]';
  for item in select c.* from public.comments c join journal_private.comment_simulation_entries e on e.comment_id=c.id where e.article_id=article.id order by c.created_at,c.id loop
   index := index+1;
   comments := comments || jsonb_build_array(jsonb_build_object('id',item.id,'name',item.name,'content',item.content,
    'currentTimestamp',to_char(item.created_at,'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'plannedTimestamp',to_char(dates[index],'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')));
  end loop;
  plan := plan || jsonb_build_array(jsonb_build_object('articleId',article.id,'title',article.title,'count',n,'status','eligible','days',days,'comments',comments));
 end loop;
 insert into journal_private.comment_simulation_date_previews(administrator_id,source,plan)
 values(auth.uid(),source,plan) returning id,expires_at into preview_id,expiry;
 return jsonb_build_object('id',preview_id,'articles',plan,'expiresAt',expiry);
end $$;

create function public.confirm_existing_simulation_dates(p_preview_id uuid,p_confirm boolean)
returns jsonb language plpgsql security definer set search_path = '' set timezone = 'UTC' as $$
declare preview journal_private.comment_simulation_date_previews; source jsonb; expected jsonb;
 article jsonb; item jsonb; n integer; changed integer; total integer := 0;
 before_other jsonb; after_other jsonb;
begin
 if not journal_private.is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
 if p_confirm is distinct from true then raise exception 'Explicit confirmation required' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(193576483,3001);
 select * into preview from journal_private.comment_simulation_date_previews where id=p_preview_id and administrator_id=auth.uid() for update;
 if not found or preview.consumed_at is not null or preview.expires_at<=clock_timestamp() then
  raise exception 'Preview unavailable, used or expired; prepare again' using errcode='22023';
 end if;
 -- Short confirmation transaction prevents concurrent moderation/cleanup/source edits.
 lock table public.articles, public.categories, public.comments, journal_private.comment_simulation_batches, journal_private.comment_simulation_entries in share row exclusive mode;
 source := journal_private.simulation_date_source();
 if source is distinct from preview.source then raise exception 'Simulation changed; prepare a fresh preview' using errcode='22023'; end if;
 select jsonb_build_object('comments',coalesce((select jsonb_agg(to_jsonb(c) order by c.id) from public.comments c where not exists(select 1 from journal_private.comment_simulation_entries e where e.comment_id=c.id)),'[]'::jsonb),
  'articles',coalesce((select jsonb_agg(to_jsonb(a) order by a.id) from public.articles a),'[]'::jsonb),
  'categories',coalesce((select jsonb_agg(to_jsonb(c) order by c.id) from public.categories c),'[]'::jsonb)) into before_other;
 -- Revalidate the persisted schedule before any UPDATE.
 for article in select value from jsonb_array_elements(preview.plan) loop
  n := (article->>'count')::integer;
  if article->>'status'='incompatible' then
   if n between 18 and 24 then raise exception 'Invalid skipped count' using errcode='22023'; end if;
   continue;
  end if;
  if n not between 18 and 24 or jsonb_array_length(article->'comments')<>n
   or (select count(*) from jsonb_array_elements(source->'entries') e where e->>'article_id'=article->>'articleId')<>n then
   raise exception 'Invalid preview count' using errcode='22023';
  end if;
  if exists(select 1 from generate_series(0,5) d where (select count(*) from jsonb_array_elements(article->'comments') c where ((c->>'plannedTimestamp')::timestamptz at time zone 'UTC')::date=date '2026-09-25'+d) not between 3 and 4)
   or exists(select 1 from jsonb_array_elements(article->'comments') c where (c->>'plannedTimestamp')::timestamptz<timestamptz '2026-09-25 00:00:00+00' or (c->>'plannedTimestamp')::timestamptz>=timestamptz '2026-10-01 00:00:00+00') then
   raise exception 'Invalid preview dates' using errcode='22023';
  end if;
  if (select jsonb_agg(c.id::text order by c.created_at,c.id) from public.comments c join journal_private.comment_simulation_entries e on e.comment_id=c.id where e.article_id=(article->>'articleId')::uuid)
   is distinct from (select jsonb_agg(c->>'id' order by (c->>'plannedTimestamp')::timestamptz) from jsonb_array_elements(article->'comments') c) then
   raise exception 'Preview ownership or ordering mismatch' using errcode='22023';
  end if;
 end loop;
 if (select count(*)<>count(distinct (c->>'plannedTimestamp')::timestamptz) from jsonb_array_elements(preview.plan) a cross join lateral jsonb_array_elements(a->'comments') c)
  or exists(select 1 from jsonb_array_elements(preview.plan) a cross join lateral jsonb_array_elements(a->'comments') c join public.comments existing on existing.created_at=(c->>'plannedTimestamp')::timestamptz) then
  raise exception 'Timestamp collision; prepare again' using errcode='22023';
 end if;
 expected := jsonb_set(source,'{comments}',coalesce((
  select jsonb_agg(case when planned.c is null then original else jsonb_set(original,'{created_at}',to_jsonb((planned.c->>'plannedTimestamp')::timestamptz)) end order by original->>'id')
  from jsonb_array_elements(source->'comments') original
  left join (select c from jsonb_array_elements(preview.plan) a cross join lateral jsonb_array_elements(a->'comments') c) planned on planned.c->>'id'=original->>'id'
 ),'[]'::jsonb));
 for article in select value from jsonb_array_elements(preview.plan) where value->>'status'='eligible' loop
  for item in select value from jsonb_array_elements(article->'comments') loop
   update public.comments c set created_at=(item->>'plannedTimestamp')::timestamptz
    from journal_private.comment_simulation_entries e
    where c.id=(item->>'id')::uuid and e.comment_id=c.id and e.article_id=(article->>'articleId')::uuid and c.article_id=e.article_id;
   get diagnostics changed = row_count;
   if changed<>1 then raise exception 'Expected comment missing' using errcode='22023'; end if;
   total := total+changed;
  end loop;
 end loop;
 if journal_private.simulation_date_source() is distinct from expected then raise exception 'Simulation preservation check failed' using errcode='22023'; end if;
 select jsonb_build_object('comments',coalesce((select jsonb_agg(to_jsonb(c) order by c.id) from public.comments c where not exists(select 1 from journal_private.comment_simulation_entries e where e.comment_id=c.id)),'[]'::jsonb),
  'articles',coalesce((select jsonb_agg(to_jsonb(a) order by a.id) from public.articles a),'[]'::jsonb),
  'categories',coalesce((select jsonb_agg(to_jsonb(c) order by c.id) from public.categories c),'[]'::jsonb)) into after_other;
 if before_other is distinct from after_other then raise exception 'Unrelated data preservation check failed' using errcode='22023'; end if;
 update journal_private.comment_simulation_date_previews set consumed_at=clock_timestamp() where id=preview.id;
 return jsonb_build_object('updated',total,'skippedArticles',(select count(*) from jsonb_array_elements(preview.plan) a where a->>'status'='incompatible'));
end $$;
revoke all on function public.prepare_existing_simulation_dates() from public, anon, authenticated;
revoke all on function public.confirm_existing_simulation_dates(uuid,boolean) from public, anon, authenticated;
grant execute on function public.prepare_existing_simulation_dates() to authenticated;
grant execute on function public.confirm_existing_simulation_dates(uuid,boolean) to authenticated;
commit;
