import { spawnSync } from 'node:child_process';
import { readFile, readdir, mkdir, mkdtemp } from 'node:fs/promises';
import path from 'node:path';
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
 for(const file of (await readdir(path.join(root,'supabase/migrations'))).filter(f=>f.endsWith('.sql')&&f<'20261001000100').sort())await sql(await readFile(path.join(root,'supabase/migrations',file),'utf8'));
 for(const file of ['schema_security.sql','reviewed_work_security.sql','comment_simulation_security.sql']){await sql(await readFile(path.join(root,'supabase/tests',file),'utf8'));console.log('PASS '+file);}
 await sql(await readFile(path.join(root,'supabase/migrations/20261001000100_new_simulation_previews.sql'),'utf8'));
 await sql(await readFile(path.join(root,'supabase/tests/new_simulation_security.sql'),'utf8'));
 console.log('PASS new_simulation_security.sql: exact preview, boundaries, authorization, preservation and cleanup');
 await sql(await readFile(path.join(root,'supabase/migrations/20261001000200_existing_simulation_dates.sql'),'utf8'));
 await sql(await readFile(path.join(root,'supabase/tests/new_simulation_security.sql'),'utf8'));
 console.log('PASS future-workflow SQL regression after installing existing-date migration');
 const {testNewSimulationConcurrency}=await import('./test-new-simulation-concurrency.mjs');
 await testNewSimulationConcurrency(db,connect);
 const {testExistingSimulationDates}=await import('./test-existing-simulation-dates.mjs');
 await testExistingSimulationDates(db,connect);
} finally {
 await Promise.allSettled(clients.map(client=>client.end()));
 if(started)run('pg_ctl',['-D',data,'-m','fast','-w','stop']);
}
