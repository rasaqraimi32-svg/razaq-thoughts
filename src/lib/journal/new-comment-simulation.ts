import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { articleFingerprint, type SimulationArticle } from "./comment-simulation-generator";
import { discoverSimulationArticles, simulationSnapshot } from "./comment-simulation";
import { prepareSimulationPlan } from "./simulation-plan";
import dataset from "./comment-simulation-dataset.json";
import { parseRichContent, richTextContent } from "./rich-content";
export type ScheduledComment = {name:string;content:string;created_at:string};
export type StoredSimulationPreview = {status:"preview";id:string;articleId:string;title:string;comments:ScheduledComment[];expiresAt:string};
export type NewSimulationArticle = {id:string;title:string;alreadySimulated:boolean;source?:{excerpt:string;category:string;content:string;publishedAt:string|null;fingerprint:string};preparedDataset?:string};
const columns="id,title,slug,excerpt,content,published_at,updated_at,categories(name)";
const signal=()=>AbortSignal.timeout(15000);
function checkedError(error:{code?:string;message?:string}) {
 if(error.code==="22023")return new Error(error.message??"Invalid simulation preview.");
 if(error.code==="PGRST202"||error.code==="42883")return new Error("The new simulation preview migration is not installed.");
 return new Error("Simulation request failed. Refresh before retrying; an interrupted confirmation may have committed.");
}
export async function inspectNewSimulationArticles(client:SupabaseClient):Promise<NewSimulationArticle[]> {
 const state=await simulationSnapshot(client), articles=await discoverSimulationArticles(client);
 return articles.map(article=>{
  if(state.articleIds.includes(article.id))return {id:article.id,title:article.title,alreadySimulated:true};
  const fingerprint=articleFingerprint(article), doc=parseRichContent(article.content);
  const entry=(dataset as Record<string,{fingerprint:string}>)[article.id];
  return {id:article.id,title:article.title,alreadySimulated:false,source:{excerpt:article.excerpt,category:article.categories?.name??"Uncategorised",content:doc?richTextContent(doc):article.content,publishedAt:article.published_at??null,fingerprint},preparedDataset:entry?.fingerprint===fingerprint?JSON.stringify(entry,null,2):JSON.stringify({fingerprint,comments:[],engagementAnchors:{agreement:0,disagreement:1,question:2,observation:3,reflection:4,clarification:5,connection:6,alternative:7}},null,2)};
 });
}
export async function prepareNewSimulation(client:SupabaseClient,id:string,input:unknown,now=Date.now()):Promise<StoredSimulationPreview|{status:"skipped";count:0}> {
 const state=await simulationSnapshot(client);
 if(state.articleIds.includes(id))return {status:"skipped",count:0};
 const result=await client.from("articles").select(columns).eq("id",id).eq("status","published").abortSignal(signal()).maybeSingle();
 if(result.error||!result.data)throw new Error("Article is unavailable or no longer published.");
 const article=result.data as unknown as SimulationArticle;
 const comments=prepareSimulationPlan(article,input,now);
 const response=await client.rpc("prepare_new_comment_simulation",{p_article_id:id,p_source:article,p_comments:comments}).abortSignal(signal());
 if(response.error)throw checkedError(response.error);
 return response.data;
}
export async function confirmNewSimulation(client:SupabaseClient,id:string) {
 const {data,error}=await client.rpc("confirm_new_comment_simulation",{p_preview_id:id,p_confirm:true}).abortSignal(signal());
 if(error)throw checkedError(error);
 return data as {status:"seeded"|"skipped";count:number};
}
