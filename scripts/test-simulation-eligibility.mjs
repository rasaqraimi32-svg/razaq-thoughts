// Called only by the disposable localhost PostgreSQL test runner.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function load(path,mocks){
 const source=readFileSync(new URL('../'+path,import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const result={exports:{}};
 vm.runInNewContext(code,{module:result,exports:result.exports,Date,Error,require:name=>name==='server-only'?{}:name in mocks?mocks[name]:require(name)});
 return result.exports;
}
export async function testSimulationEligibility(db){
 const dataset=JSON.parse(readFileSync(new URL('../src/lib/journal/comment-simulation-dataset.json',import.meta.url),'utf8'));
 const source=JSON.parse(readFileSync(new URL('../tests/fixtures/simulation-articles.json',import.meta.url),'utf8'))[0];
 const generator=load('src/lib/journal/comment-simulation-generator.ts',{'./comment-simulation-dataset.json':dataset});
 const planner=load('src/lib/journal/simulation-plan.ts',{'./comment-simulation-generator':generator});
 let checked=0;
 for(const published of ['2020-01-01T19:56:39.644263Z','2020-01-01T23:59:59.997Z']){
  const article={...source,published_at:published};
  for(let day=4;day<=7;day++)for(const millis of [2,3,43200000]){
   const now=Date.parse('2020-01-0'+day+'T00:00:00Z')+millis;
   const counts=planner.simulationEligibility(published,now).counts;
   for(let index=0;index<counts.length;index++)for(const high of [false,true]){
    let first=true;const pick=max=>{if(first){first=false;return index;}return high?max-1:0;};
    const comments=planner.prepareSimulationPlan(article,dataset[source.id],now,pick);
    assert.equal(comments.length,counts[index]);
    assert.ok(comments.every(c=>Date.parse(c.created_at)<=now));
    await db.query('select journal_private.validate_simulation_schedule($1::jsonb,$2::timestamptz)',[JSON.stringify(comments),published]);
    checked++;
   }
  }
 }
 console.log('PASS feasible selection: '+checked+' application schedules accepted by unchanged SQL validator, including exact partial-day capacities');
}
