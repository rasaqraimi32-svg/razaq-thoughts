-- Future insertion only. No UPDATE/DELETE of existing comments or batch records.
begin;
create table journal_private.comment_simulation_previews (
 id uuid primary key default gen_random_uuid(),
 article_id uuid not null references public.articles(id) on delete cascade,
 administrator_id uuid not null references auth.users(id) on delete cascade,
 source_fingerprint text not null,
 comments jsonb not null,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '24 hours',
 consumed_at timestamptz
);
alter table journal_private.comment_simulation_previews enable row level security;
revoke all on journal_private.comment_simulation_previews from public,anon,authenticated;

create function journal_private.simulation_source_fingerprint(p_id uuid)
returns text language sql stable set search_path='' as $$
 select md5(jsonb_build_object('title',a.title,'excerpt',a.excerpt,'content',a.content,'category',c.name,'published_at',a.published_at,'updated_at',a.updated_at)::text)
 from public.articles a left join public.categories c on c.id=a.category_id where a.id=p_id
$$;
revoke all on function journal_private.simulation_source_fingerprint(uuid) from public,anon,authenticated;

create function journal_private.validate_simulation_schedule(p_comments jsonb,p_published timestamptz)
returns void language plpgsql set search_path='' as $$
declare n integer; days integer; item jsonb; stamp timestamptz; first_date date;
begin
 if jsonb_typeof(p_comments) is distinct from 'array' then raise exception 'Invalid prepared comments' using errcode='22023'; end if;
 n:=jsonb_array_length(p_comments);
 if n not between 15 and 25 then raise exception 'Expected 15 to 25 comments' using errcode='22023'; end if;
 if p_published is null or p_published>statement_timestamp() then raise exception 'Invalid publication time' using errcode='22023'; end if;
 days:=case when n<=16 then 4 when n=17 then 5 when n<=24 then 6 else 7 end;
 first_date:=(p_published at time zone 'UTC')::date;
 if (select count(distinct lower(value->>'name')) from jsonb_array_elements(p_comments))<>n
 or (select count(distinct value->>'content') from jsonb_array_elements(p_comments))<>n then
  raise exception 'Duplicate names or comments' using errcode='22023';
 end if;
 for item in select value from jsonb_array_elements(p_comments) loop
  if jsonb_typeof(item->'name') is distinct from 'string' or jsonb_typeof(item->'content') is distinct from 'string'
   or jsonb_typeof(item->'created_at') is distinct from 'string'
   or (item->>'name') !~ '^[[:alpha:]]{2,40}$'
   or lower(item->>'name') in ('mr','mrs','ms','dr','prof','sir','reader','user','anonymous')
   or length(btrim(item->>'content')) not between 20 and 2000 then raise exception 'Invalid prepared comment' using errcode='22023'; end if;
  if (item->>'created_at') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$' then raise exception 'Use exact UTC millisecond timestamps' using errcode='22023'; end if;
  stamp:=(item->>'created_at')::timestamptz;
  if stamp<p_published or stamp>statement_timestamp() or (stamp at time zone 'UTC')::date not between first_date and first_date+days-1 then
   raise exception 'Timestamp is outside the elapsed publication schedule' using errcode='22023';
  end if;
 end loop;
 if (select count(distinct (value->>'created_at')::timestamptz) from jsonb_array_elements(p_comments))<>n then raise exception 'Duplicate timestamps' using errcode='22023'; end if;
 if exists(select 1 from generate_series(0,days-1) d where
  (select count(*) from jsonb_array_elements(p_comments) where ((value->>'created_at')::timestamptz at time zone 'UTC')::date=first_date+d) not between 3 and 4) then
  raise exception 'Each planned UTC day must contain 3 or 4 comments' using errcode='22023';
 end if;
end $$;
revoke all on function journal_private.validate_simulation_schedule(jsonb,timestamptz) from public,anon,authenticated;

create function public.prepare_new_comment_simulation(p_article_id uuid,p_source jsonb,p_comments jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare article public.articles; preview_id uuid; category_name text; expiry timestamptz;
begin
 if not journal_private.is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(193576483,3001);
 if exists(select 1 from journal_private.comment_simulation_batches where article_id=p_article_id) then return jsonb_build_object('status','skipped','count',0); end if;
 select * into article from public.articles where id=p_article_id for share;
 if not found or article.status<>'published' then raise exception 'Article is no longer published' using errcode='22023'; end if;
 select name into category_name from public.categories where id=article.category_id for share;
 if article.title is distinct from p_source->>'title' or article.excerpt is distinct from p_source->>'excerpt'
 or article.content is distinct from p_source->>'content' or category_name is distinct from p_source#>>'{categories,name}'
 or article.updated_at is distinct from (p_source->>'updated_at')::timestamptz
 or article.published_at is distinct from (p_source->>'published_at')::timestamptz then
  raise exception 'Article changed; prepare a new preview' using errcode='22023';
 end if;
 perform journal_private.validate_simulation_schedule(p_comments,article.published_at);
 insert into journal_private.comment_simulation_previews(article_id,administrator_id,source_fingerprint,comments)
 values(p_article_id,auth.uid(),journal_private.simulation_source_fingerprint(p_article_id),p_comments)
 returning id,expires_at into preview_id,expiry;
 return jsonb_build_object('status','preview','id',preview_id,'title',article.title,'articleId',p_article_id,'comments',p_comments,'expiresAt',expiry);
end $$;

create function public.confirm_new_comment_simulation(p_preview_id uuid,p_confirm boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare preview journal_private.comment_simulation_previews; article public.articles; item jsonb; batch uuid; new_id uuid; idx integer:=0;
begin
 if not journal_private.is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
 if p_confirm is distinct from true then raise exception 'Confirmation required' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(193576483,3001);
 select * into preview from journal_private.comment_simulation_previews where id=p_preview_id and administrator_id=auth.uid() for update;
 if not found then raise exception 'Preview not found' using errcode='22023'; end if;
 if exists(select 1 from journal_private.comment_simulation_batches where article_id=preview.article_id) then return jsonb_build_object('status','skipped','count',0); end if;
 if preview.consumed_at is not null or preview.expires_at<statement_timestamp() then raise exception 'Preview used or expired; prepare another preview' using errcode='22023'; end if;
 select * into article from public.articles where id=preview.article_id for share;
 if not found or article.status<>'published' then raise exception 'Article is no longer published' using errcode='22023'; end if;
 perform 1 from public.categories where id=article.category_id for share;
 if preview.source_fingerprint is distinct from journal_private.simulation_source_fingerprint(article.id) then raise exception 'Article changed; prepare a new preview' using errcode='22023'; end if;
 perform journal_private.validate_simulation_schedule(preview.comments,article.published_at);
 if exists(select 1 from public.comments c join jsonb_array_elements(preview.comments) planned(value) on c.created_at=(planned.value->>'created_at')::timestamptz) then raise exception 'Timestamp collision; prepare another preview' using errcode='22023'; end if;
 insert into journal_private.comment_simulation_batches(article_id) values(article.id) returning batch_id into batch;
 for item in select value from jsonb_array_elements(preview.comments) loop
  idx:=idx+1;
  insert into public.comments(article_id,name,email,content,status,created_at)
   values(article.id,item->>'name','simulation.'||batch::text||'.'||idx::text||'@example.com',item->>'content','approved',(item->>'created_at')::timestamptz) returning id into new_id;
  insert into journal_private.comment_simulation_entries(comment_id,article_id) values(new_id,article.id);
 end loop;
 update journal_private.comment_simulation_previews set consumed_at=statement_timestamp() where id=preview.id;
 return jsonb_build_object('status','seeded','count',idx);
end $$;

-- Old clients still receive a safe skip for existing batches. New insertion must
-- use a reviewed stored preview; the former immediate-insertion route is closed.
create or replace function public.seed_comment_simulation(p_article_id uuid,p_updated_at timestamptz,p_comments jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not journal_private.is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(193576483,3001);
 if exists(select 1 from journal_private.comment_simulation_batches where article_id=p_article_id) then return jsonb_build_object('status','skipped','count',0); end if;
 raise exception 'Use Seed New Published Articles and confirm a prepared preview' using errcode='22023';
end $$;
revoke all on function public.prepare_new_comment_simulation(uuid,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.confirm_new_comment_simulation(uuid,boolean) from public,anon,authenticated;
grant execute on function public.prepare_new_comment_simulation(uuid,jsonb,jsonb) to authenticated;
grant execute on function public.confirm_new_comment_simulation(uuid,boolean) to authenticated;
commit;
