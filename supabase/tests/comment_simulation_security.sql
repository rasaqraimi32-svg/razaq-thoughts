-- Disposable database ONLY. Apply migrations first. All fixtures rolled back.
begin;
set local plpgsql.check_asserts = on;
do $$ begin
 assert (select count(*) from public.profiles)=0, 'Use a fresh test database';
 assert (select count(*) from public.comments)=0, 'Use a fresh test database';
end $$;
insert into auth.users(id) values ('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');
insert into public.profiles(id,display_name) values ('00000000-0000-4000-8000-000000000001','Admin');
insert into public.articles(id,title,slug,excerpt,content,status) values
 ('10000000-0000-4000-8000-000000000001','One','simulation-one','Excerpt','Content','published'),
 ('10000000-0000-4000-8000-000000000002','Two','simulation-two','Excerpt','Content','published'),
 ('10000000-0000-4000-8000-000000000003','Draft','simulation-draft','Excerpt','Content','draft');
insert into public.comments(article_id,name,email,content,status)
 select '10000000-0000-4000-8000-000000000001','Genuine','simulation.forged@example.com','Genuine '||s,s from unnest(array['approved','pending','rejected']) s;
create temporary table genuine_snapshot as select * from public.comments;
create temporary table article_snapshot as select * from public.articles;
create temporary table simulation_payload as select jsonb_agg(jsonb_build_object('name',name,'content','A distinct substantive simulated response from '||name)) as body
 from unnest(array['Amaka','Tunde','Ngozi','Chinedu','Aisha','Kwame','Thandi','Naledi','Sarah','David','Emily','Kenji','Priya','Mei','Lucia']) name;
grant select on simulation_payload to authenticated;
set local role anon;
set local request.jwt.claim.sub = '';
do $$ begin
 begin perform public.comment_simulation_snapshot(); raise exception 'Anonymous snapshot allowed'; exception when insufficient_privilege then null; end;
 begin perform public.seed_comment_simulation(null,null,'[]'); raise exception 'Anonymous seeding allowed'; exception when insufficient_privilege then null; end;
 begin perform public.remove_comment_simulation('',true); raise exception 'Anonymous cleanup allowed'; exception when insufficient_privilege then null; end;
 begin perform * from journal_private.comment_simulation_entries; raise exception 'Anonymous ledger read'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000002';
do $$ begin
 begin perform public.comment_simulation_snapshot(); raise exception 'Non-admin snapshot allowed'; exception when insufficient_privilege then null; end;
 begin perform public.seed_comment_simulation(null,null,'[]'); raise exception 'Non-admin seeding allowed'; exception when insufficient_privilege then null; end;
 begin perform public.remove_comment_simulation('',true); raise exception 'Non-admin cleanup allowed'; exception when insufficient_privilege then null; end;
end $$;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
do $$ declare result jsonb; token text; payload jsonb; stamp timestamptz; begin
 select body into payload from simulation_payload;
 select updated_at into stamp from public.articles where slug='simulation-one';
 begin perform * from journal_private.comment_simulation_entries; raise exception 'Admin direct ledger read'; exception when insufficient_privilege then null; end;
 begin perform public.seed_comment_simulation('10000000-0000-4000-8000-000000000003',stamp,payload); raise exception 'Draft seed allowed'; exception when invalid_parameter_value then null; end;
 begin perform public.seed_comment_simulation('10000000-0000-4000-8000-000000000001',null,payload); raise exception 'Stale article allowed'; exception when invalid_parameter_value then null; end;
 begin perform public.seed_comment_simulation('10000000-0000-4000-8000-000000000001',stamp,'[]'); raise exception 'Invalid count allowed'; exception when invalid_parameter_value then null; end;
 begin perform public.seed_comment_simulation('10000000-0000-4000-8000-000000000001',stamp,jsonb_set(payload,'{14,name}','"Dr"')); raise exception 'Title allowed'; exception when invalid_parameter_value then null; end;
 assert (public.comment_simulation_snapshot()->>'count')::int=0, 'Failed seed left partial comments';
 result:=public.seed_comment_simulation('10000000-0000-4000-8000-000000000001',stamp,payload);
 assert result->>'status'='seeded' and (result->>'count')::int=15, 'Seed result incorrect';
 result:=public.seed_comment_simulation('10000000-0000-4000-8000-000000000001',stamp,payload);
 assert result->>'status'='skipped' and (result->>'count')::int=0, 'Duplicate seeding not skipped';
 assert (public.comment_simulation_snapshot()->>'count')::int=15, 'Duplicate inserted rows';
 token:=public.comment_simulation_snapshot()->>'token';
 perform public.seed_comment_simulation('10000000-0000-4000-8000-000000000002',(select updated_at from public.articles where slug='simulation-two'),payload);
 begin perform public.remove_comment_simulation(token,true); raise exception 'Stale cleanup allowed'; exception when invalid_parameter_value then null; end;
 begin perform public.remove_comment_simulation(public.comment_simulation_snapshot()->>'token',false); raise exception 'Unconfirmed cleanup allowed'; exception when invalid_parameter_value then null; end;
end $$;
reset role;
do $$ begin
 assert (select count(*) from journal_private.comment_simulation_entries)=30;
 assert not exists(select 1 from public.comments c join journal_private.comment_simulation_entries e on e.comment_id=c.id where c.status<>'approved' or c.article_id<>e.article_id or c.email !~ '^simulation[.][a-f0-9-]+[.][0-9]+@example[.]com$');
 assert (select count(distinct email) from public.comments c join journal_private.comment_simulation_entries e on e.comment_id=c.id)=30;
 assert not exists(select * from genuine_snapshot except select * from public.comments), 'Genuine comments altered by seed';
end $$;
set local role anon;
set local request.jwt.claim.sub='';
do $$ begin
 assert (select count(id) from public.comments)=31, 'Approved simulation comments not publicly visible';
 begin perform email from public.comments; raise exception 'Email leaked'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
-- Existing moderation still operates on real and simulated rows.
update public.comments set status='rejected' where name='Amaka';
do $$ declare result jsonb; begin
 assert (select count(*) from public.get_admin_comments())=33, 'Moderation read broken';
 result:=public.remove_comment_simulation(public.comment_simulation_snapshot()->>'token',true);
 assert (result->>'removed')::int=30 and (result->>'remaining')::int=0 and (result->>'errors')::int=0, 'Cleanup count incorrect';
 assert jsonb_array_length(public.comment_simulation_snapshot()->'articleIds')=0, 'Cleanup failed to reset batches';
 result:=public.remove_comment_simulation(public.comment_simulation_snapshot()->>'token',true);
 assert (result->>'removed')::int=0, 'Repeated cleanup not safe';
end $$;
reset role;
do $$ begin
 assert (select count(*) from public.comments)=3, 'Cleanup deleted genuine comments or left simulation rows';
 assert not exists(select * from genuine_snapshot except select * from public.comments), 'Genuine comments changed';
 assert not exists(select * from article_snapshot except select * from public.articles), 'Articles changed';
 assert (select count(*) from journal_private.comment_simulation_batches)=0;
end $$;
rollback;
