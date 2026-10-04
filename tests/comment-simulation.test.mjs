import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url);
export function load(path,mocks={}) {
 const source=readFileSync(new URL('../'+path,import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const result={exports:{}};
 vm.runInNewContext(code,{module:result,exports:result.exports,AbortSignal,Error,require:name=>name === "server-only" ? {} : name in mocks?mocks[name]:require(name)});
 return result.exports;
}
const articles=JSON.parse(readFileSync(new URL('./fixtures/simulation-articles.json',import.meta.url),'utf8'));
const dataset=JSON.parse(readFileSync(new URL('../src/lib/journal/comment-simulation-dataset.json',import.meta.url),'utf8'));
const generator=load('src/lib/journal/comment-simulation-generator.ts',{'./comment-simulation-dataset.json':dataset});
const service=load('src/lib/journal/comment-simulation.ts',{'./comment-simulation-generator':generator});
for(const article of articles) test('article-specific generation: '+article.title,()=>{
 assert.equal(dataset[article.id].fingerprint,generator.articleFingerprint(article));
 assert.equal(new Set(dataset[article.id].comments).size,25);
 for(const bound of [0,10]) {
  const comments=generator.generateSimulatedComments(article,max=>max===11?bound:0);
  assert.equal(comments.length,15+bound);
  for(const index of Object.values(dataset[article.id].engagementAnchors))assert.ok(comments.some(c=>c.content===dataset[article.id].comments[index]),"Every engagement type is represented");
  assert.equal(new Set(comments.map(c=>c.name.toLowerCase())).size,comments.length);
  for(const c of comments){assert.match(c.name,/^[A-Za-z]{2,40}$/);assert.ok(c.content.length>=20&&c.content.length<=2000);assert.ok(dataset[article.id].comments.includes(c.content));}
 }
});
test('all 150 comments are distinct across articles, with no generic fallback',()=>{
 const bodies=Object.values(dataset).flatMap(d=>d.comments);
 assert.equal(bodies.length,150);assert.equal(new Set(bodies).size,150);
 assert.throws(()=>generator.generateSimulatedComments({...articles[0],id:'unknown'}),/new or edited/);
 for(const key of ['title','excerpt','content'])assert.throws(()=>generator.generateSimulatedComments({...articles[0],[key]:'Changed'}),/new or edited/);
 assert.throws(()=>generator.generateSimulatedComments({...articles[0],categories:{name:'Changed'}}),/new or edited/);
});
test('counts are sampled independently and names span a broad pool',()=>{
 const counts=new Set(),names=new Set();
 for(let i=0;i<100;i++){const comments=generator.generateSimulatedComments(articles[i%4]);counts.add(comments.length);comments.forEach(c=>names.add(c.name));}
 assert.ok(counts.size>1);assert.ok(names.size>100);
});
test('discovery reads all pages even when the server caps each response',async()=>{
 let calls=0;
 const client={from(table){assert.equal(table,'articles');let cursor='';return {select(columns){assert.match(columns,/content/);return this;},eq(k,v){assert.equal(k,'status');assert.equal(v,'published');return this;},order(k){assert.equal(k,'id');return this;},limit(){return this;},gt(k,v){cursor=v;return this;},async abortSignal(){calls++;return {data:articles.filter(a=>a.id>cursor).slice(0,1),error:null};}};}};
 const result=await service.discoverSimulationArticles(client);assert.equal(result.length,4);assert.equal(calls,5);
});
test('discovery errors never masquerade as an empty successful inventory',async()=>{
 const chain={select(){return this;},eq(){return this;},order(){return this;},limit(){return this;},abortSignal:async()=>({error:{message:'private'}})};
 await assert.rejects(service.discoverSimulationArticles({from:()=>chain}),/discovery failed/);
});
function fake(article=articles[0],seeded=false,rpcError=null){
 const calls=[];
 return {calls,from(){return {select(){return this;},eq(){return this;},abortSignal(){return this;},maybeSingle:async()=>({data:article,error:null})};},rpc(name,args){calls.push({name,args});return {abortSignal:async()=>name==='comment_simulation_snapshot'?{data:{count:0,articleIds:seeded?[article.id]:[],token:'a'.repeat(32)}}:{data:{status:'seeded',count:args.p_comments?.length},error:rpcError}};}};
}
test('correct article ID and generated count reach the guarded RPC',async()=>{
 const client=fake();const result=await service.seedSimulationArticle(client,articles[0].id);
 assert.equal(result.status,'seeded');assert.ok(result.count>=15&&result.count<=25);
 const call=client.calls.at(-1);assert.equal(call.args.p_article_id,articles[0].id);assert.equal(call.args.p_updated_at,articles[0].updated_at);
 assert.equal(result.count,call.args.p_comments.length);
});
test('already seeded articles are skipped without any insert RPC',async()=>{
 const client=fake(articles[0],true);const result=await service.seedSimulationArticle(client,articles[0].id);
 assert.equal(result.status,'skipped');assert.equal(client.calls.length,1);
});
test('article failures are reported, and the next article can still succeed',async()=>{
 const fail=await service.seedSimulationArticle(fake({...articles[0],content:'edited'}),articles[0].id);
 assert.equal(fail.status,'failed');assert.match(fail.error,/new or edited/);
 const ok=await service.seedSimulationArticle(fake(articles[1]),articles[1].id);assert.equal(ok.status,'seeded');
});
test('database internals are not returned as simulation errors',async()=>{
 const result=await service.seedSimulationArticle(fake(articles[0],false,{code:'XX000',message:'secret'}),articles[0].id);
 assert.equal(result.status,'failed');assert.doesNotMatch(result.error,/secret/);
});
test('every server action reauthorizes before database access',async()=>{
 const actions=load('src/app/admin/(protected)/simulation-actions.ts',{
  'next/cache':{revalidatePath(){}},'@/lib/supabase/admin':{requireAdmin:async()=>{throw Error('denied');}},
  '@/lib/supabase/server':{createClient:async()=>{assert.fail('Unauthorized database access');}},
  '@/lib/journal/validation':{uuidPattern:/./},'@/lib/journal/comment-simulation':service,
 });
 for(const invoke of [()=>actions.discoverSimulationAction(),()=>actions.seedSimulationAction(articles[0].id,true),()=>actions.previewSimulationCleanupAction(),()=>actions.removeSimulationAction('a'.repeat(32),true)])await assert.rejects(invoke(),/denied/);
});
test('seed and cleanup require explicit confirmation',async()=>{
 const actions=load('src/app/admin/(protected)/simulation-actions.ts',{
  'next/cache':{revalidatePath(){}},'@/lib/supabase/admin':{requireAdmin:async()=>{}},
  '@/lib/supabase/server':{createClient:async()=>{assert.fail('Unconfirmed access');}},
  '@/lib/journal/validation':{uuidPattern:/^[a-f0-9-]{36}$/},'@/lib/journal/comment-simulation':service,
 });
 await assert.rejects(actions.seedSimulationAction(articles[0].id,false),/confirmation/);
 await assert.rejects(actions.removeSimulationAction('a'.repeat(32),false),/confirmation/);
});

test('public article renders the actual simulated names and content, without emails',async()=>{
 const comments=generator.generateSimulatedComments(articles[0]);
 const component=fn=>({__esModule:true,default:fn});
 const article={id:articles[0].id,title:articles[0].title,slug:articles[0].slug,excerpt:articles[0].excerpt,category:'Education',author:'Author',publishedAt:'2026-09-30',readingTime:4,content:[]};
 const page=load('src/app/articles/[slug]/page.tsx',{
  '@/components/ArticleContent':component(()=>null), '@/components/ReviewedWork':component(()=>null),
  '@/lib/journal/reviewed-work-queries':{getPublishedReviewedWork:async()=>null},
  '@/components/CommentForm':component(()=>React.createElement('form',null,'Submit comment')),
  '@/lib/site-metadata':{publicPageMetadata:()=>({})},
  '@/lib/journal/comment-queries':{getApprovedComments:async()=>comments.map((c,i)=>({...c,id:String(i),createdAt:'2026-09-30'}))},
  '@/lib/journal/public-queries':{getPublishedArticle:async()=>article,getPublishedArticles:async()=>({articles:[]})},
  '@/lib/journal/types':{formatDate:()=> '30 Sep 2026'},
  '@/components/ArticleCard':component(()=>null), '@/components/ShareArticle':component(()=>null),
  'next/link':component(({children,href})=>React.createElement('a',{href},children)),
  'next/navigation':{notFound:()=>{throw Error('Not found');}},
 });
 const html=renderToStaticMarkup(await page.default({params:Promise.resolve({slug:article.slug})}));
 assert.equal((html.match(/class="comment-item"/g)||[]).length,comments.length);
 for(const c of comments)assert.ok(html.includes(c.name));
 assert.match(html,/Submit comment/);assert.doesNotMatch(html,/@example.com/);
});
