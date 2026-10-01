// Runs only against the disposable PostgreSQL instance created by the SQL runner.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function testExistingSimulationDates(db, connect) {
 const adminId='00000000-0000-4000-8000-000000000001';
 const admin=await connect(), second=await connect(), visitor=await connect();
 for(const client of [admin,second])await client.query(`set role authenticated; set request.jwt.claim.sub='${adminId}';`);
 await visitor.query("set role authenticated; set request.jwt.claim.sub='00000000-0000-4000-8000-000000000002';");
 const prepare=async(client=admin)=>(await client.query('select public.prepare_existing_simulation_dates() as p')).rows[0].p;
 const confirm=async(p,client=admin)=>(await client.query('select public.confirm_existing_simulation_dates($1,true) as p',[p.id])).rows[0].p;
 const state=async()=> (await db.query(`select jsonb_build_object(
  'comments',(select jsonb_agg(to_jsonb(c) order by id) from public.comments c),
  'batches',(select jsonb_agg(to_jsonb(b) order by article_id) from journal_private.comment_simulation_batches b),
  'entries',(select jsonb_agg(to_jsonb(e) order by comment_id) from journal_private.comment_simulation_entries e),
  'articles',(select jsonb_agg(to_jsonb(a) order by id) from public.articles a),
  'categories',(select jsonb_agg(to_jsonb(c) order by id) from public.categories c)) as s`)).rows[0].s;
 const pass=name=>console.log('PASS existing dates: '+name);
 await db.query('delete from public.articles');
 const fixtures=[
  ['Perhaps Sustainability Needs a Different Story',19],
  ['What Do We Miss When We Study Plants Without Studying People?',18],
  ['What If the Land Is Also a Teacher?',18],
  ['Whose Knowledge, Whose Terms?',24]
 ];
 for(const [title,count] of fixtures){
  const id=randomUUID();
  await db.query("insert into public.articles(id,title,slug,excerpt,content,status,published_at) values($1::uuid,$2,$1::text,'Excerpt','Preserved article source','published','2026-09-01T10:00:00Z')",[id,title]);
  await db.query('insert into journal_private.comment_simulation_batches(article_id) values($1)',[id]);
  // Ties exercise the deterministic ID tie-break, including PostgreSQL microseconds.
  await db.query(`with inserted as (insert into public.comments(article_id,name,email,content,status,created_at)
   select $1,'Amaka','fixture@example.com','Preserved comment '||i,'approved','2026-09-30T10:00:00.123456Z'::timestamptz+(i/2)*interval '1 second' from generate_series(1,$2::int) i returning id,article_id)
   insert into journal_private.comment_simulation_entries select id,article_id from inserted`,[id,count]);
 }
 const articleId=(await db.query('select article_id from journal_private.comment_simulation_batches order by article_id limit 1')).rows[0].article_id;
 await db.query("insert into public.comments(article_id,name,email,content,status,created_at) values($1,'David','visitor@example.com','Genuine comment remains unchanged','pending','2026-09-25T12:00:00Z')",[articleId]);
 const original=await state();
 await assert.rejects(prepare(visitor),/Administrator access/);
 await assert.rejects(confirm({id:randomUUID()},visitor),/Administrator access/);
 await visitor.query('set role anon');
 await assert.rejects(prepare(visitor),/permission denied/);
 await assert.rejects(confirm({id:randomUUID()},visitor),/permission denied/);
 await assert.rejects(admin.query('select * from journal_private.comment_simulation_date_previews'),/permission denied/);
 await assert.rejects(admin.query('select journal_private.simulation_date_source()'),/permission denied/);
 await assert.rejects(admin.query("update public.comments set created_at=now()"),/permission denied/);
 pass('anonymous/non-admin denied; private storage/helper and direct timestamp updates denied');

 const preview=await prepare();
 assert.deepEqual(await state(),original,'Preparation changed existing data');
 assert.equal(preview.articles.length,4);
 const planned=preview.articles.flatMap(a=>a.comments);
 assert.equal(planned.length,79);
 assert.equal(new Set(planned.map(c=>c.plannedTimestamp)).size,79);
 for(const article of preview.articles){
  assert.equal(article.status,'eligible');assert.equal(article.days.length,6);
  for(const day of article.days){assert.ok(day.count===3||day.count===4);assert.equal(article.comments.filter(c=>c.plannedTimestamp.startsWith(day.date)).length,day.count);}
  assert.deepEqual(article.comments.map(c=>c.plannedTimestamp),article.comments.map(c=>c.plannedTimestamp).sort());
  for(const c of article.comments){assert.ok(c.plannedTimestamp>='2026-09-25T00:00:00.000Z'&&c.plannedTimestamp<'2026-10-01T00:00:00.000Z');assert.equal(c.content,original.comments.find(old=>old.id===c.id).content);}
 }
 const patterns=new Set(), times=new Set();
 for(let i=0;i<20;i++){const p=await prepare();const a=p.articles.find(a=>a.count===19);patterns.add(JSON.stringify(a.days));times.add(a.comments[0].plannedTimestamp);}
 assert.ok(patterns.size>1);assert.ok(times.size>1);
 pass('79-comment complete preview; six valid UTC days, unique ascending times, randomized fourth day and times; preparation preserves everything');
 const eighteen=preview.articles.find(a=>a.count===18).articleId;
 for(let count=18;count<=24;count++){
  await db.query(`begin; set local request.jwt.claim.sub='${adminId}';`);
  await db.query(`with inserted as (insert into public.comments(article_id,name,email,content,status)
   select $1,'Nia','range@example.com','Extra local test comment','approved' from generate_series(1,$2::int) returning id,article_id)
   insert into journal_private.comment_simulation_entries select id,article_id from inserted`,[eighteen,count-18]);
  const p=(await db.query('select public.prepare_existing_simulation_dates() as p')).rows[0].p;
  const article=p.articles.find(a=>a.articleId===eighteen);
  assert.equal(article.count,count);assert.equal(article.days.filter(d=>d.count===4).length,count-18);
  assert.equal((await db.query('select public.confirm_existing_simulation_dates($1,true) as p',[p.id])).rows[0].p.updated,79+count-18);
  await db.query('rollback');
 }
 assert.deepEqual(await state(),original);
 pass('every valid count 18–24 produces and applies the exact six-day distribution');
 await assert.rejects(admin.query('select public.confirm_existing_simulation_dates($1,false)',[preview.id]),/confirmation/);
 // Test binding independently of admin check by changing only the private owner fixture.
 const otherUser=randomUUID();await db.query('insert into auth.users(id) values($1)',[otherUser]);
 const wrongOwner=await prepare();await db.query('update journal_private.comment_simulation_date_previews set administrator_id=$1 where id=$2',[otherUser,wrongOwner.id]);
 await assert.rejects(confirm(wrongOwner),/unavailable/);
 const expired=await prepare();await db.query("update journal_private.comment_simulation_date_previews set expires_at=now()-interval '1 minute' where id=$1",[expired.id]);
 await assert.rejects(confirm(expired),/expired/);
 pass('explicit confirmation, owner binding and expiry enforced');

 const result=await confirm(preview);assert.equal(result.updated,79);assert.equal(result.skippedArticles,0);
 const after=await state();
 for(const key of ['batches','entries','articles','categories'])assert.deepEqual(after[key],original[key],key+' changed');
 assert.equal(after.comments.length,80);
 for(const comment of after.comments){
  const old=original.comments.find(c=>c.id===comment.id);const p=planned.find(c=>c.id===comment.id);
  if(!p)assert.deepEqual(comment,old);
  else {assert.deepEqual({...comment,created_at:old.created_at},old);assert.equal(Date.parse(comment.created_at),Date.parse(p.plannedTimestamp));}
 }
 await assert.rejects(confirm(preview),/used/);
 pass('exact 79 timestamp changes; all other fields, genuine comment, four batches, ledger, articles and categories identical; replay denied');

 for(const mutation of [
  {sql:"update public.comments set content=content||' edited' where id=$1",arg:planned[0].id},
  {sql:"update public.comments set created_at=created_at+interval '1 second' where id=$1",arg:planned[0].id},
  {sql:'delete from journal_private.comment_simulation_entries where comment_id=$1',arg:planned[0].id},
  {sql:'update journal_private.comment_simulation_batches set batch_id=gen_random_uuid() where article_id=$1',arg:articleId},
  {sql:'delete from public.comments where id=$1',arg:planned[0].id}
 ]){
  const p=await prepare();
  // Exercise in one transaction/session with the same auth claims, without persisting fixtures.
  await db.query(`begin; set local request.jwt.claim.sub='${adminId}';`);await db.query(mutation.sql,[mutation.arg]);
  await db.query('savepoint expected_rejection');
  await assert.rejects(db.query('select public.confirm_existing_simulation_dates($1,true)',[p.id]),/Simulation changed/);
  await db.query('rollback');
  assert.deepEqual(await state(),after);
 }
 pass('stale content, timestamp, membership, batch identity and missing comment reject atomically');

 const mismatch=await prepare();
 await db.query(`begin; set local request.jwt.claim.sub='${adminId}';`);
 await db.query('update journal_private.comment_simulation_entries set article_id=$1 where comment_id=$2',[preview.articles.find(a=>a.articleId!==preview.articles[0].articleId).articleId,preview.articles[0].comments[0].id]);
 await db.query('savepoint bad_owner');
 await assert.rejects(db.query('select public.prepare_existing_simulation_dates()'),/ownership mismatch/);
 await db.query('rollback to bad_owner');
 await assert.rejects(db.query('select public.confirm_existing_simulation_dates($1,true)',[mismatch.id]),/Simulation changed/);
 await db.query('rollback');
 assert.deepEqual(await state(),after);
 pass('ledger/comment article ownership mismatch rejects preparation and stale confirmation');

 const collision=await prepare();
 await db.query(`begin; set local request.jwt.claim.sub='${adminId}';`);
 await db.query("insert into public.comments(article_id,name,email,content,created_at) values($1,'Emma','collision@example.com','New genuine comment',$2)",[articleId,collision.articles[0].comments[0].plannedTimestamp]);
 await assert.rejects(db.query('select public.confirm_existing_simulation_dates($1,true)',[collision.id]),/Timestamp collision/);
 await db.query('rollback');
 assert.deepEqual(await state(),after);
 pass('new genuine timestamp collision rejects confirmation without touching comments');

 // Both valid previews start from the same source. One commits, the other becomes stale.
 const p1=await prepare(),p2=await prepare();
 await admin.query('begin;select pg_advisory_xact_lock(193576483,3001)');
 const pending=confirm(p2,second).then(value=>({value}),error=>({error}));
 let waiting=false;
 for(let i=0;i<100;i++){const s=await db.query('select wait_event from pg_stat_activity where pid=$1',[second.processID]);if(s.rows[0]?.wait_event==='advisory'){waiting=true;break;}await new Promise(r=>setTimeout(r,20));}
 assert.ok(waiting,'Second session must wait on shared advisory lock');
 await confirm(p1);await admin.query('commit');
 const conflict=await pending;assert.match(conflict.error?.message??'',/Simulation changed/);
 await assert.rejects(confirm(p1,second),/used/);
 pass('two real sessions: advisory wait observed; first commits, conflicting preview and replay rejected');

 const beforeFailure=await state(), rollbackPreview=await prepare();
 await db.query(`create sequence public.test_date_update_counter;
  create function public.test_reject_date_update() returns trigger language plpgsql as $$ begin
   if nextval('public.test_date_update_counter')=5 then raise exception 'Injected fifth update failure'; end if; return new; end $$;
  create trigger test_reject_date_update before update on public.comments for each row execute function public.test_reject_date_update()`);
 await assert.rejects(confirm(rollbackPreview),/Injected fifth update failure/);
 assert.equal(Number((await db.query('select last_value from public.test_date_update_counter')).rows[0].last_value),5);
 assert.deepEqual(await state(),beforeFailure);
 assert.equal((await db.query('select consumed_at from journal_private.comment_simulation_date_previews where id=$1',[rollbackPreview.id])).rows[0].consumed_at,null);
 await db.query('drop trigger test_reject_date_update on public.comments;drop function public.test_reject_date_update();drop sequence public.test_date_update_counter');
 await confirm(rollbackPreview);
 pass('failure on fifth UPDATE rolls back prior updates and preview consumption; same preview succeeds after removing failure');

 const beforeSideEffect=await state(), sideEffectPreview=await prepare();
 await db.query(`create function public.test_date_side_effect() returns trigger language plpgsql as $$ begin new.content:=new.content||' unwanted change'; return new; end $$;
  create trigger test_date_side_effect before update on public.comments for each row execute function public.test_date_side_effect()`);
 await assert.rejects(confirm(sideEffectPreview),/preservation check failed/);
 assert.deepEqual(await state(),beforeSideEffect);
 assert.equal((await db.query('select consumed_at from journal_private.comment_simulation_date_previews where id=$1',[sideEffectPreview.id])).rows[0].consumed_at,null);
 await db.query('drop trigger test_date_side_effect on public.comments;drop function public.test_date_side_effect()');
 pass('runtime preservation assertion detects trigger content side effects and rolls back all changes');

 // Incompatible articles and draft batches still participate in the authoritative snapshot.
 for(const n of [0,17,25]){
  const id=randomUUID();await db.query("insert into public.articles(id,title,slug,excerpt,content,status) values($1::uuid,$2,$1::text,'Excerpt','Draft source','draft')",[id,'Invalid '+n]);
  await db.query('insert into journal_private.comment_simulation_batches(article_id) values($1)',[id]);
  await db.query(`with inserted as(insert into public.comments(article_id,name,email,content) select $1,'Nia','invalid@example.com','Preserved invalid comment' from generate_series(1,$2::int) returning id,article_id) insert into journal_private.comment_simulation_entries select id,article_id from inserted`,[id,n]);
 }
 await db.query("update public.articles set status='draft' where id=$1",[articleId]);
 const invalidBefore=await state(), mixed=await prepare();
 assert.equal(mixed.articles.filter(a=>a.status==='incompatible').length,3);
 assert.equal(mixed.articles.find(a=>a.articleId===articleId).status,'eligible');
 const mixedResult=await confirm(mixed);assert.equal(mixedResult.updated,79);assert.equal(mixedResult.skippedArticles,3);
 const invalidAfter=await state();
 const skipIds=new Set(mixed.articles.filter(a=>a.status==='incompatible').map(a=>a.articleId));
 assert.deepEqual(invalidAfter.comments.filter(c=>skipIds.has(c.article_id)),invalidBefore.comments.filter(c=>skipIds.has(c.article_id)));
 for(const key of ['batches','entries','articles','categories'])assert.deepEqual(invalidAfter[key],invalidBefore[key]);
 pass('counts 0/17/25 skipped unchanged; valid draft batch included; all ledger records preserved');

 const cleanup=(await admin.query("select public.remove_comment_simulation(public.comment_simulation_snapshot()->>'token',true) as result")).rows[0].result;
 assert.equal(cleanup.removed,121);assert.equal(cleanup.remaining,0);
 assert.deepEqual((await state()).comments,original.comments.filter(c=>!planned.some(p=>p.id===c.id)));
 pass('existing cleanup removes only 121 ledger comments, preserves genuine row exactly');
 const empty=await prepare();assert.deepEqual(empty.articles,[]);assert.equal((await confirm(empty)).updated,0);
 pass('empty ledger is safe');
}
