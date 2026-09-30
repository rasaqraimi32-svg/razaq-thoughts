import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {JSDOM} from 'jsdom';
const require=createRequire(import.meta.url);
function load(path,mocks={}){const code=ts.transpileModule(readFileSync(new URL('../'+path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX}}).outputText;const result={exports:{}};vm.runInNewContext(code,{module:result,exports:result.exports,Error,Date,AbortSignal,require:name=>name==='server-only'?{}:name in mocks?mocks[name]:require(name)});return result.exports;}
const dataset=JSON.parse(readFileSync(new URL('../src/lib/journal/comment-simulation-dataset.json',import.meta.url),'utf8'));
const fixtures=JSON.parse(readFileSync(new URL('./fixtures/simulation-articles.json',import.meta.url),'utf8'));
const generator=load('src/lib/journal/comment-simulation-generator.ts',{'./comment-simulation-dataset.json':dataset});
const planner=load('src/lib/journal/simulation-plan.ts',{'./comment-simulation-generator':generator});
const published='2026-09-01T19:23:45.123Z',now=Date.parse('2026-10-01T12:00:00Z');
for(let n=15;n<=25;n++)test('UTC schedule for '+n+' comments',()=>{
 const times=planner.planTimestamps(n,published,now);assert.equal(times.length,n);assert.equal(new Set(times).size,n);
 const days=new Map();for(const time of times){assert.ok(Date.parse(time)>=Date.parse(published));assert.ok(Date.parse(time)<=now);days.set(time.slice(0,10),(days.get(time.slice(0,10))??0)+1);}
 assert.equal(days.size,n<=16?4:n===17?5:n<=24?6:7);assert.equal([...days.keys()][0],'2026-09-01');for(const count of days.values())assert.ok(count===3||count===4);
});
test('rejects insufficient days, missing/future publication and too little first-day time',()=>{
 assert.throws(()=>planner.planTimestamps(25,published,Date.parse('2026-09-03T23:00:00Z')),/Not yet eligible/);
 assert.throws(()=>planner.planTimestamps(15,null,now),/publication/);
 assert.throws(()=>planner.planTimestamps(15,'2027-01-01T00:00:00Z',now),/publication/);
 assert.throws(()=>planner.planTimestamps(15,'2026-09-01T23:59:59.999Z',now),/too little/);
});
test('late publication and partial current day remain within exact elapsed boundaries',()=>{
 const pub='2026-09-01T23:59:58.000Z',end=Date.parse('2026-09-04T09:00:00Z');const times=planner.planTimestamps(15,pub,end);
 assert.ok(times.every(t=>Date.parse(t)>=Date.parse(pub)&&Date.parse(t)<=end));
});
test('four-comment days and times vary across schedules',()=>{
 const schedules=Array.from({length:20},()=>planner.planTimestamps(21,published,now));
 assert.ok(new Set(schedules.map(s=>s.join())).size>1);
 const patterns=schedules.map(s=>{const dates={};s.forEach(t=>dates[t.slice(0,10)]=(dates[t.slice(0,10)]??0)+1);return JSON.stringify(dates);});assert.ok(new Set(patterns).size>1);
});
for(const source of fixtures)test('prepared content stays bound to '+source.title,()=>{
 const article={...source,published_at:published};const input=dataset[source.id];const plan=planner.prepareSimulationPlan(article,input,now);
 assert.ok(plan.length>=15&&plan.length<=25);assert.equal(new Set(plan.map(c=>c.name)).size,plan.length);
 for(const c of plan){assert.match(c.name,/^[A-Za-z]{2,40}$/);assert.ok(input.comments.includes(c.content));}
 for(const index of Object.values(input.engagementAnchors))assert.ok(plan.some(c=>c.content===input.comments[index]));
 for(const field of ['title','excerpt','content'])assert.throws(()=>planner.prepareSimulationPlan({...article,[field]:'changed'},input,now),/fingerprint/);
 assert.throws(()=>planner.prepareSimulationPlan({...article,categories:{name:'changed'}},input,now),/fingerprint/);
});
test('new article can use its own prepared dataset without changing the static four',()=>{
 const article={...fixtures[0],id:'new-article',title:'New discussion of ethnobotany',published_at:published};const input={...dataset[fixtures[0].id],fingerprint:generator.articleFingerprint(article)};
 assert.ok(planner.prepareSimulationPlan(article,input,now).length>=15);
 const bad={...input,comments:Array(25).fill('The same repetitive generic response.')};assert.throws(()=>planner.validatePreparedDataset(article,bad),/distinct/);
 assert.throws(()=>planner.validatePreparedDataset(article,{...input,engagementAnchors:{}}),/anchors/);
});
test('name allocation keeps approximately half African-group names and uses broad variety',()=>{
 const source=readFileSync(new URL('../src/lib/journal/comment-simulation-generator.ts',import.meta.url),'utf8');const groups=[...source.matchAll(/^ "([^"\n]+)",?$/gm)].map(m=>m[1].split(' '));assert.equal(groups.length,5);
 const african=new Set([...groups[0],...groups[1]]),all=new Set();
 for(let i=0;i<60;i++){const plan=generator.assignSimulationNames(Array(25).fill('Content'));assert.equal(plan.filter(c=>african.has(c.name)).length,13);plan.forEach(c=>all.add(c.name));}
 assert.ok(all.size>100);
});
const rich=load('src/lib/journal/rich-content.ts');
function service(snapshot,discover){return load('src/lib/journal/new-comment-simulation.ts',{'./comment-simulation-generator':generator,'./simulation-plan':planner,'./comment-simulation':{simulationSnapshot:async()=>snapshot,discoverSimulationArticles:async()=>discover},'./comment-simulation-dataset.json':dataset,'./rich-content':rich});}
test('existing batch is excluded before source preparation, even after content edits',async()=>{
 const svc=service({articleIds:[fixtures[0].id]},[{...fixtures[0],content:'bad rich content'}]);const rows=await svc.inspectNewSimulationArticles({});assert.equal(rows[0].alreadySimulated,true);assert.equal(rows[0].source,undefined);
 const result=await svc.prepareNewSimulation({from(){assert.fail('Existing article read');},rpc(){assert.fail('Existing batch write');}},fixtures[0].id,null,now);assert.equal(result.status,'skipped');
});
test('confirmation sends only the stored preview ID, never regenerated comments',async()=>{
 const svc=service({},[]);const calls=[];const client={rpc(name,args){calls.push({name,args});return {abortSignal:async()=>({data:{status:'seeded',count:18}})}}};
 const result=await svc.confirmNewSimulation(client,'preview-id');assert.equal(result.count,18);assert.deepEqual(JSON.parse(JSON.stringify(calls)),[{name:'confirm_new_comment_simulation',args:{p_preview_id:'preview-id',p_confirm:true}}]);
});
test('all new actions authorize before loading services',async()=>{
 const actions=load('src/app/admin/(protected)/simulation-actions.ts',{'next/cache':{},'@/lib/supabase/admin':{requireAdmin:async()=>{throw Error('denied');}},'@/lib/supabase/server':{},'@/lib/journal/validation':{},'@/lib/journal/comment-simulation':{}});
 for(const invoke of [()=>actions.inspectNewSimulationAction(),()=>actions.prepareNewSimulationAction('id','{}'),()=>actions.confirmNewSimulationAction('id',true)])await assert.rejects(invoke(),/denied/);
});

test('PostgreSQL microsecond publication boundary rounds upward, never backward',()=>{
 const times=planner.planTimestamps(15,'2026-09-01T20:00:00.123456Z',now,()=>0);
 assert.equal(times[0],'2026-09-01T20:00:00.124Z');
});

test('full admin preview renders every name, comment and exact UTC timestamp',()=>{
 const article={...fixtures[0],published_at:published};const comments=planner.prepareSimulationPlan(article,dataset[article.id],now,max=>max===11?10:0);
 const states=[[[{id:article.id,title:article.title,alreadySimulated:false,text:'{}',source:{content:'Source content'},preview:{id:'preview',comments,expiresAt:'2026-10-02T00:00:00Z'}}],()=>{}],[false,()=>{}],['',()=>{}]];
 const ui=load('src/components/admin/NewSimulationWorkflow.tsx',{'react':{...React,useState:()=>states.shift()},'@/app/admin/(protected)/simulation-actions':{}});
 const html=renderToStaticMarkup(React.createElement(ui.default));const doc=new JSDOM(html).window.document;
 assert.equal(doc.querySelectorAll('ol li').length,25);
 for(const c of comments){assert.ok(doc.body.textContent.includes(c.name));assert.ok(doc.body.textContent.includes(c.content));assert.ok(doc.querySelector('time[datetime="'+c.created_at+'"]'));}
 assert.match(doc.body.textContent,/Confirm this exact batch/);
});
test('new source preparation stores the same generated payload returned for preview',async()=>{
 const article={...fixtures[0],id:'new-article',published_at:published};const input={...dataset[fixtures[0].id],fingerprint:generator.articleFingerprint(article)};
 const svc=service({articleIds:[]},[]);let stored;
 const client={from(){return {select(){return this;},eq(){return this;},abortSignal(){return this;},maybeSingle:async()=>({data:article})};},rpc(name,args){assert.equal(name,'prepare_new_comment_simulation');assert.equal(args.p_article_id,article.id);stored=JSON.parse(JSON.stringify(args.p_comments));return {abortSignal:async()=>({data:{status:'preview',id:'stored-id',comments:stored}})};}};
 const preview=await svc.prepareNewSimulation(client,article.id,input,now);assert.deepEqual(preview.comments,stored);assert.ok(stored.length>=15&&stored.length<=25);
});
