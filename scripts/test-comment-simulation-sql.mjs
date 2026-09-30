import { spawnSync } from 'node:child_process';
import { readFile, readdir, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url);
const {Client}=require(process.env.SIMULATION_PG_MODULE || path.join(root,'node_modules/.cache/simulation-postgres/node_modules/pg'));
const bin=process.env.SIMULATION_POSTGRES_BIN || path.join(root,'node_modules/.cache/simulation-postgres/node_modules/@embedded-postgres/windows-x64/native/bin');
const exe=name=>path.join(bin,name+(process.platform==='win32'?'.exe':''));
const port=Number(process.env.SIMULATION_TEST_PORT || '55439');
const parent=path.join(root,'node_modules/.cache/simulation-postgres');await mkdir(parent,{recursive:true});
const data=await mkdtemp(path.join(parent,'test-data-'));
function run(name,args){const result=spawnSync(exe(name),args,{cwd:root,encoding:'utf8',timeout:60000,windowsHide:true});if(result.status!==0)throw Error(name+': '+(result.error?.message||result.stderr||result.stdout));return result.stdout;}
const clients=[];
async function connect(){const client=new Client({host:'127.0.0.1',port,user:'postgres',database:'postgres',connectionTimeoutMillis:10000,query_timeout:20000});await client.connect();clients.push(client);return client;}
let started=false;
try {
 run('initdb',['-D',data,'-U','postgres','-A','trust','--no-locale','-E','UTF8']);
 run('pg_ctl',['-D',data,'-l',path.join(data,'server.log'),'-o','-h 127.0.0.1 -p '+port,'-w','start']);started=true;
 const db=await connect();const sql=query=>db.query(query);
 await sql(await readFile(path.join(root,'scripts/simulation-test-bootstrap.sql'),'utf8'));
 for(const file of (await readdir(path.join(root,'supabase/migrations'))).filter(f=>f.endsWith('.sql')).sort())await sql(await readFile(path.join(root,'supabase/migrations',file),'utf8'));
 for(const file of ['schema_security.sql','reviewed_work_security.sql','comment_simulation_security.sql']){await sql(await readFile(path.join(root,'supabase/tests',file),'utf8'));console.log('PASS '+file);}
 const articles=JSON.parse(await readFile(path.join(root,'tests/fixtures/simulation-articles.json'),'utf8'));
 const dataset=JSON.parse(await readFile(path.join(root,'src/lib/journal/comment-simulation-dataset.json'),'utf8'));
 const admin="set role authenticated; set request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';";
 await sql("insert into auth.users(id) values('00000000-0000-4000-8000-000000000001'); insert into public.profiles(id,display_name) values('00000000-0000-4000-8000-000000000001','Admin');");
 for(const a of articles)await db.query('insert into public.articles(id,title,slug,excerpt,content,status) values($1,$2,$3,$4,$5,$6)',[a.id,a.title,a.slug,a.excerpt,a.content,'published']);
 const names=['Amaka','Chinedu','Tunde','Kelechi','Aisha','Thandi','Kwame','Zanele','David','Sarah','Emily','James','Arjun','Priya','Kenji','Mei','Emma','Lucas','Nia','Daniel','Sofia','Rohan','Ngozi','Fatima','Ayanda'];
 const id=articles[0].id;
 const payload=JSON.stringify(dataset[id].comments.slice(0,15).map((content,i)=>({name:names[i],content})));
 const seed='select public.seed_comment_simulation($1,(select updated_at from public.articles where id=$1),$2::jsonb) as result';
 const first=await connect(),second=await connect();
 await first.query('begin;'+admin+'select pg_advisory_xact_lock(193576483,3001);');
 await second.query(admin);
 const pending=second.query(seed,[id,payload]);
 // Verify session two actually waits on the advisory lock before session one seeds.
 let waiting=false;
 for(let i=0;i<100;i++){
  const state=await db.query("select wait_event from pg_stat_activity where pid=$1",[second.processID]);
  if(state.rows[0]?.wait_event==='advisory'){waiting=true;break;}
  await new Promise(resolve=>setTimeout(resolve,20));
 }
 assert.ok(waiting,'Second session must wait on the application lock');
 const firstResult=await first.query(seed,[id,payload]);await first.query('commit');
 const secondResult=await pending;
 assert.equal(firstResult.rows[0].result.status,'seeded');assert.equal(secondResult.rows[0].result.status,'skipped');
 assert.equal((await sql('select count(*)::int as n from public.comments')).rows[0].n,15);
 console.log('PASS real two-session concurrent duplicate seeding: advisory wait observed, one seeded, one skipped, 15 rows');
 const report=[];
 await sql(admin+"select public.remove_comment_simulation(public.comment_simulation_snapshot()->>'token',true);");
 const {randomInt}=await import('node:crypto');
 for(const a of articles){const count=randomInt(15,26);const anchors=new Set(Object.values(dataset[a.id].engagementAnchors));const comments=[...dataset[a.id].comments.filter((_,i)=>anchors.has(i)),...dataset[a.id].comments.filter((_,i)=>!anchors.has(i))].slice(0,count);const rows=comments.map((content,i)=>({name:names[i],content}));await db.query(seed,[a.id,JSON.stringify(rows)]);report.push({title:a.title,count});}
 console.log('PASS actual-article SQL seeding: '+JSON.stringify(report));
 await sql("select public.remove_comment_simulation(public.comment_simulation_snapshot()->>'token',true);");
 assert.equal((await sql('select count(id)::int as n from public.comments')).rows[0].n,0);
 console.log('PASS actual-article cleanup: zero remaining');
 await mkdir(path.join(root,'docs'),{recursive:true});
 await writeFile(path.join(root,'docs/comment-simulation-sql-results.json'),JSON.stringify({database:'Disposable local PostgreSQL 18; minimal Auth/Storage compatibility fixtures',suites:['schema_security','reviewed_work_security','comment_simulation_security'],concurrent:{advisoryWaitObserved:true,seeded:1,skipped:1,comments:15},articles:report,remainingAfterCleanup:0},null,2)+'\n');
} finally {
 await Promise.allSettled(clients.map(client=>client.end()));
 if(started)run('pg_ctl',['-D',data,'-m','fast','-w','stop']);
}
