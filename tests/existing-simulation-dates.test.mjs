import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
const require=createRequire(import.meta.url);
function load(path,mocks={}){
 const code=ts.transpileModule(readFileSync(new URL('../'+path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const result={exports:{}};vm.runInNewContext(code,{module:result,exports:result.exports,Error,Date,AbortSignal,require:name=>name==='server-only'?{}:name in mocks?mocks[name]:require(name)});return result.exports;
}
const service=load('src/lib/journal/existing-simulation-dates.ts');
test('existing date service prepares through the guarded RPC without a client supplied plan',async()=>{
 const preview={id:'stored-preview',articles:[]};const client={rpc(name,args){assert.equal(name,'prepare_existing_simulation_dates');assert.equal(args,undefined);return {abortSignal:async()=>({data:preview})};}};
 assert.equal(await service.prepareExistingSimulationDates(client),preview);
});
test('existing date confirmation sends only preview ID and explicit confirmation',async()=>{
 const client={rpc(name,args){assert.equal(name,'confirm_existing_simulation_dates');assert.deepEqual(JSON.parse(JSON.stringify(args)),{p_preview_id:'stored-preview',p_confirm:true});return {abortSignal:async()=>({data:{updated:79,skippedArticles:0}})};}};
 assert.equal((await service.confirmExistingSimulationDates(client,'stored-preview')).updated,79);
});
for(const [code,message,expected] of [['22023','Simulation changed; prepare again',/Simulation changed/],['PGRST202','not found',/migration is not installed/],['42883','not found',/migration is not installed/],['500','private diagnostic',/outcome is unknown/]])test('existing date RPC error '+code+' is handled safely',async()=>{
 const client={rpc(){return {abortSignal:async()=>({error:{code,message}})};}};
 await assert.rejects(service.prepareExistingSimulationDates(client),expected);
 await assert.rejects(service.confirmExistingSimulationDates(client,'id'),expected);
});
function actions(overrides={}){
 return load('src/app/admin/(protected)/simulation-date-actions.ts',{'next/cache':{revalidatePath(){}},'@/lib/supabase/admin':{requireAdmin:async()=>{}},'@/lib/supabase/server':{createClient:async()=>({})},'@/lib/journal/validation':{uuidPattern:/^[0-9a-f-]{36}$/},'@/lib/journal/existing-simulation-dates':{},...overrides});
}
test('both existing date server actions authorize before any service access',async()=>{
 const a=actions({'@/lib/supabase/admin':{requireAdmin:async()=>{throw Error('denied');}}});
 await assert.rejects(a.previewExistingSimulationDatesAction(),/denied/);
 await assert.rejects(a.confirmExistingSimulationDatesAction('id',true),/denied/);
});
test('confirmation refuses missing confirmation and invalid IDs without database calls',async()=>{
 const a=actions({'@/lib/supabase/server':{createClient(){assert.fail('Database called');}}});
 for(const [id,confirmed] of [['bad',true],['00000000-0000-4000-8000-000000000001',false],[null,true]])assert.match((await a.confirmExistingSimulationDatesAction(id,confirmed)).error,/explicit confirmation/);
});
test('actions return stored preview and invalidate article/admin views only after success',async()=>{
 const paths=[],preview={id:'test'},a=actions({'next/cache':{revalidatePath(...args){paths.push(args);}},'@/lib/journal/existing-simulation-dates':{prepareExistingSimulationDates:async()=>preview,confirmExistingSimulationDates:async()=>({updated:79,skippedArticles:0})}});
 assert.equal((await a.previewExistingSimulationDatesAction()).result,preview);assert.equal(paths.length,0);
 assert.equal((await a.confirmExistingSimulationDatesAction('00000000-0000-4000-8000-000000000001',true)).result.updated,79);
 assert.deepEqual(paths,[['/admin/comments'],['/articles/[slug]','page']]);
});
test('failed confirmation returns error without revalidating or reporting success',async()=>{
 const a=actions({'next/cache':{revalidatePath(){assert.fail('Failure invalidated cache');}},'@/lib/journal/existing-simulation-dates':{confirmExistingSimulationDates:async()=>{throw Error('Simulation changed');}}});
 const result=await a.confirmExistingSimulationDatesAction('00000000-0000-4000-8000-000000000001',true);assert.equal(result.error,'Simulation changed');assert.equal(result.result,undefined);
});
function render(preview){
 const states=[[preview,()=>{}],[false,()=>{}],['',()=>{}],['',()=>{}]];
 const ui=load('src/components/admin/ExistingSimulationDates.tsx',{'react':{...React,useState:()=>states.shift()},'@/app/admin/(protected)/simulation-date-actions':{}});
 return new JSDOM(renderToStaticMarkup(React.createElement(ui.default))).window.document;
}
test('full UI preview shows all 79 identities, content, original and exact planned UTC timestamps',()=>{
 const articles=[19,18,18,24].map((count,a)=>({articleId:'article-'+a,title:'Article '+a,count,status:'eligible',days:Array.from({length:6},(_,i)=>({date:'2026-09-'+(25+i),count:3})),comments:Array.from({length:count},(_,i)=>({id:`comment-${a}-${i}`,name:'Amaka',content:`Unique preserved response ${a}/${i}`,currentTimestamp:'2026-09-30T10:00:00.123456Z',plannedTimestamp:`2026-09-25T07:00:${String(i).padStart(2,'0')}.${a}00Z`}))}));
 const doc=render({id:'p',articles,expiresAt:'2026-10-02T10:00:00Z'});
 assert.equal(doc.querySelectorAll('ol li').length,79);assert.equal(doc.querySelectorAll('time').length,158);
 for(const c of articles.flatMap(a=>a.comments))for(const value of Object.values(c))assert.ok(doc.body.textContent.includes(value));
 assert.match(doc.body.textContent,/Confirm these exact timestamps \(79 comments\)/);
});
test('incompatible and empty previews cannot be confirmed in UI',()=>{
 for(const articles of [[],[{articleId:'a',title:'Invalid article',count:17,status:'incompatible',days:[],comments:[]}]]){
  const doc=render({id:'p',articles,expiresAt:'expiry'});const confirm=[...doc.querySelectorAll('button')].find(b=>b.textContent.startsWith('Confirm'));
  assert.ok(confirm.disabled);assert.equal(doc.querySelectorAll('ol li').length,0);
  assert.match(doc.body.textContent,articles.length?/Incompatible count — skipped/:/No existing simulation batches/);
 }
});
