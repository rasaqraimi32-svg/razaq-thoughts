-- Disposable local database only. Fixtures and assertions roll back.
begin;
set local plpgsql.check_asserts=on;
insert into auth.users(id) values('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');
insert into public.profiles(id,display_name) values('00000000-0000-4000-8000-000000000001','Admin');
insert into public.articles(id,title,slug,excerpt,content,status,published_at) values
 ('10000000-0000-4000-8000-000000000001','Existing','existing','Excerpt','Existing source','published','2020-01-01T19:30:00Z'),
 ('10000000-0000-4000-8000-000000000002','New','new','Excerpt','New source','published','2020-01-01T19:30:00Z'),
 ('10000000-0000-4000-8000-000000000003','Draft','draft','Excerpt','Draft source','draft',null);
insert into public.comments(id,article_id,name,email,content,status,created_at) values
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Amaka','old@example.com','Existing simulated comment','approved','2020-02-01T12:00:00Z'),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','David','genuine@example.com','Genuine pending comment','pending','2020-02-02T12:00:00Z'),
 ('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002','Emma','visitor@example.com','Genuine approved comment','approved','2020-02-03T12:00:00Z');
insert into journal_private.comment_simulation_batches(article_id) values('10000000-0000-4000-8000-000000000001');
insert into journal_private.comment_simulation_entries(comment_id,article_id) values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001');
create temp table original_comments as select * from public.comments;
create temp table original_batches as select * from journal_private.comment_simulation_batches;
create temp table original_entries as select * from journal_private.comment_simulation_entries;
create temp table original_articles as select * from public.articles;
create temp table original_categories as select * from public.categories;
create temp table test_plan as
select jsonb_agg(jsonb_build_object('name',name,'content','A distinct prepared article response by '||name,'created_at',to_char('2020-01-01 20:00:00'::timestamp+((ordinality-1)/3)*interval '1 day'+ordinality*interval '1 second','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) order by ordinality) as payload
from unnest(array['Amaka','Tunde','Ngozi','Aisha','Chinedu','Thandi','Kwame','Nia','David','Sarah','Emily','Arjun','Priya','Kenji','Mei','Lucia','Sofia','Emma']) with ordinality as people(name,ordinality);
grant select on test_plan to authenticated;
set local role anon;
do $$ begin
 begin perform public.prepare_new_comment_simulation(null,null,null);raise exception 'Anonymous preview allowed';exception when insufficient_privilege then null;end;
 begin perform public.confirm_new_comment_simulation(null,true);raise exception 'Anonymous confirmation allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000002';
do $$ begin
 begin perform public.prepare_new_comment_simulation(null,null,null);raise exception 'Non-admin preview allowed';exception when insufficient_privilege then null;end;
 begin perform public.confirm_new_comment_simulation(null,true);raise exception 'Non-admin confirmation allowed';exception when insufficient_privilege then null;end;
end $$;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
do $$ declare source jsonb; payload jsonb; result jsonb; preview_id uuid; begin
 begin perform * from journal_private.comment_simulation_previews;raise exception 'Direct preview access allowed';exception when insufficient_privilege then null;end;
 assert public.prepare_new_comment_simulation('10000000-0000-4000-8000-000000000001',null,null)->>'status'='skipped', 'Existing batch must skip before validation';
 assert public.seed_comment_simulation('10000000-0000-4000-8000-000000000001',null,null)->>'status'='skipped';
 begin perform public.seed_comment_simulation('10000000-0000-4000-8000-000000000002',null,null);raise exception 'Unpreviewed legacy insertion allowed';exception when invalid_parameter_value then null;end;
 select to_jsonb(a) into source from public.articles a where slug='new';select p.payload into payload from test_plan p;
 begin perform public.prepare_new_comment_simulation('10000000-0000-4000-8000-000000000003',source,payload);raise exception 'Draft preview allowed';exception when invalid_parameter_value then null;end;
 begin perform public.prepare_new_comment_simulation('10000000-0000-4000-8000-000000000002',jsonb_set(source,'{title}','"Wrong title"'),payload);raise exception 'Stale source allowed';exception when invalid_parameter_value then null;end;
 begin perform public.prepare_new_comment_simulation('10000000-0000-4000-8000-000000000002',source,jsonb_set(payload,'{0,created_at}','"2020-01-01T18:00:00.000Z"'));raise exception 'Before-publication comment allowed';exception when invalid_parameter_value then null;end;
 begin perform public.prepare_new_comment_simulation('10000000-0000-4000-8000-000000000002',source,jsonb_set(payload,'{0,created_at}','"2099-01-01T20:00:00.000Z"'));raise exception 'Future comment allowed';exception when invalid_parameter_value then null;end;
 begin perform public.prepare_new_comment_simulation('10000000-0000-4000-8000-000000000002',source,jsonb_set(payload,'{0,created_at}',payload#>'{1,created_at}'));raise exception 'Duplicate time allowed';exception when invalid_parameter_value then null;end;
 begin perform public.prepare_new_comment_simulation('10000000-0000-4000-8000-000000000002',source,jsonb_set(payload,'{0,created_at}','"2020-01-02T21:00:00.000Z"'));raise exception 'Invalid daily count allowed';exception when invalid_parameter_value then null;end;
 result:=public.prepare_new_comment_simulation('10000000-0000-4000-8000-000000000002',source,payload);
 assert result->'comments'=payload, 'Preview differs from prepared data';preview_id:=(result->>'id')::uuid;
 assert (select count(id) from public.comments)=3, 'Preview inserted comments';
 begin perform public.confirm_new_comment_simulation(preview_id,false);raise exception 'Unconfirmed insertion allowed';exception when invalid_parameter_value then null;end;
 result:=public.confirm_new_comment_simulation(preview_id,true);assert result->>'status'='seeded' and (result->>'count')::int=18;
 assert public.confirm_new_comment_simulation(preview_id,true)->>'status'='skipped','Replay inserted duplicate';
end $$;
reset role;
do $$ begin
 assert not exists(select * from original_comments except select * from public.comments),'Existing comments changed';
 assert not exists(select * from original_batches except select * from journal_private.comment_simulation_batches),'Existing batches changed';
 assert not exists(select * from original_entries except select * from journal_private.comment_simulation_entries),'Existing ledger changed';
 assert not exists(select * from original_articles except select * from public.articles),'Articles changed';
 assert not exists(select * from original_categories except select * from public.categories),'Categories changed';
 assert (select count(*) from public.comments)=21,'Wrong total';
 assert not exists(select 1 from public.comments c join journal_private.comment_simulation_entries e on e.comment_id=c.id where e.article_id='10000000-0000-4000-8000-000000000002' and (c.status<>'approved' or c.email not like '%@example.com' or c.created_at<'2020-01-01T19:30:00Z' or c.created_at>now()));
 assert (select count(*) from public.comments c join jsonb_array_elements((select payload from test_plan)) p on c.name=p->>'name' and c.content=p->>'content' and c.created_at=(p->>'created_at')::timestamptz where c.article_id='10000000-0000-4000-8000-000000000002')=18,'Exact preview not preserved';
end $$;
set local role anon;
set local request.jwt.claim.sub='';
do $$ begin
 assert (select count(id) from public.comments)=20,'Approved comments not public';
 begin perform email from public.comments;raise exception 'Email leaked';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
do $$ declare result jsonb; begin
 result:=public.remove_comment_simulation(public.comment_simulation_snapshot()->>'token',true);
 assert (result->>'removed')::int=19 and (result->>'remaining')::int=0,'Ledger cleanup changed';
end $$;
reset role;
do $$ begin
 assert (select count(*) from public.comments)=2,'Cleanup removed genuine comments';
 assert not exists(select * from original_comments where email<>'old@example.com' except select * from public.comments),'Genuine comments changed during cleanup';
end $$;
rollback;
