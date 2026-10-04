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


test('three-millisecond boundary days never receive an impossible fourth comment',()=>{
 const pub='2026-10-01T23:59:59.997Z',end=Date.parse('2026-10-04T00:00:00.003Z');
 for(const pick of [()=>0,max=>max-1]){
  const times=planner.planTimestamps(15,pub,end,pick);
  assert.equal(times.filter(t=>t.startsWith('2026-10-01')).length,3);
  assert.equal(times.filter(t=>t.startsWith('2026-10-04')).length,4);
  assert.ok(times.every(t=>Date.parse(t)>=Date.parse(pub)&&Date.parse(t)<=end));
 }
 assert.throws(()=>planner.planTimestamps(16,pub,end),/Not yet eligible/);
});
test('current time rounds inward to prevent a future millisecond timestamp',()=>{
 const end=Date.parse('2026-10-04T00:00:00.002Z')+0.9;
 const times=planner.planTimestamps(15,'2026-10-01T19:56:39.644263Z',end,max=>max-1);
 assert.ok(times.every(t=>Date.parse(t)<=end));
 assert.equal(times.filter(t=>t.startsWith('2026-10-04')).length,3);
});
test('manual candidate count, lengths, distinctness and anchors remain mandatory',()=>{
 const article={...fixtures[0],published_at:published},input=dataset[article.id];
 for(const count of [0,15,24,26])assert.throws(()=>planner.validatePreparedDataset(article,{...input,comments:Array.from({length:count},(_,i)=>'Distinct candidate with sufficient length '+i)}),/25 distinct/);
 for(const bad of ['short','x'.repeat(2001)])assert.throws(()=>planner.validatePreparedDataset(article,{...input,comments:[bad,...input.comments.slice(1)]}),/25 distinct/);
 assert.equal(planner.validatePreparedDataset(article,input),input);
});


function assertSchedule(plan,pub,end){
 const dates=new Map();
 assert.equal(new Set(plan.map(c=>c.created_at)).size,plan.length);
 for(const comment of plan){
  assert.ok(Date.parse(comment.created_at)>=Date.parse(pub));assert.ok(Date.parse(comment.created_at)<=end);
  const date=comment.created_at.slice(0,10);dates.set(date,(dates.get(date)??0)+1);
 }
 assert.equal(dates.size,planner.simulationDays(plan.length));
 assert.equal([...dates.keys()][0],pub.slice(0,10));
 for(const count of dates.values())assert.ok(count===3||count===4);
}
test('October 1 articles with four available dates only select 15 or 16',()=>{
 for(const pub of ['2026-10-01T19:56:39.644263+00:00','2026-10-01T19:50:13.347765+00:00']){
  const end=Date.parse('2026-10-04T12:00:00Z'),article={...fixtures[0],published_at:pub};
  const eligibility=planner.simulationEligibility(pub,end);
  assert.deepEqual(Array.from(eligibility.counts),[15,16]);assert.equal(eligibility.availableUtcDates,4);
  for(const index of [0,1])for(const tail of [()=>0,max=>max-1]){
   let first=true;const random=max=>{if(first){first=false;assert.equal(max,2);return index;}return tail(max);};
   const plan=planner.prepareSimulationPlan(article,dataset[article.id],end,random);
   assert.equal(plan.length,15+index);assertSchedule(plan,pub,end);
  }
 }
});
test('eligible ranges expand using the unchanged database count/day mapping',()=>{
 const pub='2026-10-01T19:56:39.644263Z';
 for(const [day,maximum] of [[3,null],[4,16],[5,17],[6,24],[7,25],[8,25]]){
  const eligibility=planner.simulationEligibility(pub,Date.parse('2026-10-0'+day+'T12:00:00Z'));
  assert.equal(eligibility.minimum,maximum===null?null:15);assert.equal(eligibility.maximum,maximum);
  assert.deepEqual(Array.from(eligibility.counts),maximum===null?[]:Array.from({length:maximum-14},(_,i)=>15+i));
 }
});
test('every selectable count is schedulable for exact partial-day capacities',()=>{
 const pubs=['2026-10-01T19:56:39.644263Z','2026-10-01T23:59:59.997Z','2026-10-01T23:59:59.996001Z'];
 for(const pub of pubs)for(let day=4;day<=7;day++)for(const millis of [0,1,2,3,4,43200000]){
  const end=Date.parse('2026-10-0'+day+'T00:00:00Z')+millis,article={...fixtures[0],published_at:pub};
  const counts=planner.simulationEligibility(pub,end).counts;
  for(let index=0;index<counts.length;index++)for(const high of [false,true]){
   let first=true;const pick=max=>{if(first){first=false;return index;}return high?max-1:0;};
   const plan=planner.prepareSimulationPlan(article,dataset[article.id],end,pick);
   assert.equal(plan.length,counts[index]);assertSchedule(plan,pub,end);
  }
 }
});
test('capacity can reduce the range and leave holes; selection uses actual feasible counts',()=>{
 const pub='2026-10-01T23:59:59.997Z';
 const short=planner.simulationEligibility(pub,Date.parse('2026-10-04T00:00:00.003Z'));
 assert.deepEqual(Array.from(short.counts),[15]);
 const mature=planner.simulationEligibility(pub,Date.parse('2026-10-07T12:00:00Z'));
 assert.deepEqual(Array.from(mature.counts),[15,17,18,19,20,21,22,23,25]);
});
test('too little elapsed time fails before randomness or preview RPC',async()=>{
 const pub='2026-10-01T19:56:39.644263Z',end=Date.parse('2026-10-03T23:59:59Z');
 const article={...fixtures[0],published_at:pub};
 assert.throws(()=>planner.prepareSimulationPlan(article,dataset[article.id],end,()=>assert.fail('Random count selected without a feasible schedule')),/Not enough elapsed time yet/);
 const svc=service({articleIds:[]},[]);
 const client={from(){return {select(){return this;},eq(){return this;},abortSignal(){return this;},maybeSingle:async()=>({data:article})};},rpc(){assert.fail('Preview created before eligibility');}};
 await assert.rejects(svc.prepareNewSimulation(client,article.id,dataset[article.id],end),/Not enough elapsed time yet/);
});
test('publication microseconds at midnight do not skip the unschedulable first UTC date',()=>{
 const pub='2026-10-01T23:59:59.999999Z',end=Date.parse('2026-10-07T12:00:00Z');
 assert.equal(planner.simulationEligibility(pub,end).availableUtcDates,7);
 assert.equal(planner.simulationEligibility(pub,end).counts.length,0);
 assert.throws(()=>planner.planTimestamps(15,pub,end),/too little/);
});
test('missing or future publication stays rejected before any preview creation',async()=>{
 for(const pub of [null,'2027-01-01T00:00:00Z']){
  const article={...fixtures[0],published_at:pub};
  assert.throws(()=>planner.prepareSimulationPlan(article,dataset[article.id],now),/publication/);
  const svc=service({articleIds:[]},[article]);const rows=await svc.inspectNewSimulationArticles({},now);
  assert.equal(rows[0].eligibility.counts.length,0);assert.match(rows[0].eligibility.message,/publication/);
 }
});
test('inspection returns both new preparation forms and accurate eligibility without touching existing batches',async()=>{
 const first={...fixtures[0],id:'new-one',published_at:'2026-10-01T19:56:39.644263Z'};
 const second={...fixtures[1],id:'new-two',published_at:'2026-10-01T19:50:13.347765Z'};
 const rows=await service({articleIds:[fixtures[2].id]},[first,second,fixtures[2]]).inspectNewSimulationArticles({},Date.parse('2026-10-04T12:00:00Z'));
 for(const row of rows.slice(0,2)){assert.equal(row.alreadySimulated,false);assert.deepEqual(Array.from(row.eligibility.counts),[15,16]);assert.equal(JSON.parse(row.preparedDataset).comments.length,0);}
 assert.equal(rows[2].alreadySimulated,true);assert.equal(rows[2].eligibility,undefined);assert.equal(rows[2].preparedDataset,undefined);
});
test('preparation UI shows feasible ranges, waiting state and visible manual instructions',()=>{
 const rows=[{id:'ready',title:'Ready article',alreadySimulated:false,text:'{}',eligibility:{counts:[15,16],minimum:15,maximum:16}}, {id:'waiting',title:'Waiting article',alreadySimulated:false,text:'{}',eligibility:{counts:[],minimum:null,maximum:null,message:planner.simulationWaitingMessage}}];
 const states=[[rows,()=>{}],[false,()=>{}],['',()=>{}]];
 const ui=load('src/components/admin/NewSimulationWorkflow.tsx',{'react':{...React,useState:()=>states.shift()},'@/app/admin/(protected)/simulation-actions':{}});
 const doc=new JSDOM(renderToStaticMarkup(React.createElement(ui.default))).window.document;
 assert.match(doc.body.textContent,/This article currently supports 15–16 simulated comments/);
 assert.ok(doc.body.textContent.includes(planner.simulationWaitingMessage));
 assert.match(doc.body.textContent,/The number will increase as more days become available/);
 assert.equal(doc.querySelectorAll('details[open]').length,2);
 assert.match(doc.body.textContent,/Provide 25 article-specific candidate comments before clicking/);
});

const authoredArticles=JSON.parse(readFileSync(new URL('./fixtures/new-simulation-articles.json',import.meta.url),'utf8'));
for(const article of authoredArticles)test('live October 1 authored dataset preloads and schedules safely: '+article.title,async()=>{
 const input=dataset[article.id];
 assert.equal(article.status,'published');
 assert.equal(input.fingerprint,generator.articleFingerprint(article));
 assert.equal(input.comments.length,25);
 assert.equal(new Set(input.comments).size,25);
 assert.deepEqual(Object.keys(input.engagementAnchors).sort(),['agreement','alternative','clarification','connection','disagreement','observation','question','reflection']);
 assert.equal(new Set(Object.values(input.engagementAnchors)).size,8);
 planner.validatePreparedDataset(article,input);
 const current=Date.parse('2026-10-04T20:00:00Z');
 const rows=await service({articleIds:[]},[article]).inspectNewSimulationArticles({},current);
 assert.deepEqual(JSON.parse(rows[0].preparedDataset),input);
 assert.deepEqual(Array.from(rows[0].eligibility.counts),[15,16]);
 for(const int of [()=>0,max=>max-1]){
  const plan=planner.prepareSimulationPlan(article,input,current,int);
  assert.ok([15,16].includes(plan.length));
  const days={};
  for(const c of plan){assert.ok(Date.parse(c.created_at)>=Math.ceil(Date.parse(article.published_at)+0.001));assert.ok(Date.parse(c.created_at)<=current);days[c.created_at.slice(0,10)]=(days[c.created_at.slice(0,10)]??0)+1;}
  assert.equal(Object.keys(days).length,4);assert.ok(Object.values(days).every(n=>n===3||n===4));
  for(const index of Object.values(input.engagementAnchors))assert.ok(plan.some(c=>c.content===input.comments[index]));
 }
});
