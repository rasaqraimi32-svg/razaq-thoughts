import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateSimulatedComments, type SimulationArticle } from "./comment-simulation-generator";
export type SimulationSnapshot = { count: number; articleIds: string[]; token: string };
export type SimulationResult = { id: string; title: string; status: "seeded" | "skipped" | "failed"; count: number; error?: string };
const columns = "id,title,slug,excerpt,content,updated_at,categories(name)";
const signal = () => AbortSignal.timeout(15000);
function databaseError(error: { code?: string; message?: string }) {
 if (error.code === "22023") return error.message ?? "Invalid simulation request.";
 if (error.code === "42501") return "Administrator access required.";
 if (error.code === "PGRST202" || error.code === "42883") return "The simulation migration has not been applied.";
 return "Database operation failed. Reload the simulation state before retrying; an interrupted response may have committed.";
}
export async function simulationSnapshot(client: SupabaseClient): Promise<SimulationSnapshot> {
 const {data,error} = await client.rpc("comment_simulation_snapshot").abortSignal(signal());
 if(error) throw new Error(databaseError(error));
 return data as SimulationSnapshot;
}
/** Keyset pagination advances by actual returned rows, including server response caps. */
export async function discoverSimulationArticles(client: SupabaseClient): Promise<SimulationArticle[]> {
 const articles: SimulationArticle[] = []; let cursor = "";
 for (;;) {
  let query = client.from("articles").select(columns).eq("status","published").order("id").limit(100);
  if(cursor) query = query.gt("id",cursor);
  const {data,error} = await query.abortSignal(signal());
  if(error) throw new Error("Published article discovery failed; no complete inventory is available.");
  if(!data?.length) break;
  const rows = data as unknown as SimulationArticle[];
  const next = rows[rows.length-1].id;
  if(next <= cursor) throw new Error("Article pagination did not advance.");
  articles.push(...rows); cursor=next;
 }
 return articles;
}
export async function seedSimulationArticle(client: SupabaseClient, id: string): Promise<SimulationResult> {
 let title = id;
 try {
  const {data,error} = await client.from("articles").select(columns).eq("id",id).eq("status","published").abortSignal(signal()).maybeSingle();
  if(error || !data) throw new Error("Article could not be read or is no longer published.");
  const article = data as unknown as SimulationArticle; title = article.title;
  const state = await simulationSnapshot(client);
  if(state.articleIds.includes(id)) return {id,title,status:"skipped",count:0};
  const comments = generateSimulatedComments(article);
  const result = await client.rpc("seed_comment_simulation",{p_article_id:id,p_updated_at:article.updated_at,p_comments:comments}).abortSignal(signal());
  if(result.error) throw new Error(databaseError(result.error));
  return {id,title,status:result.data.status,count:result.data.count};
 } catch(error) {
  return {id,title,status:"failed",count:0,error:error instanceof Error ? error.message : "Simulation failed; refresh before retrying."};
 }
}
export async function cleanupSimulation(client: SupabaseClient, token: string) {
 const {data,error} = await client.rpc("remove_comment_simulation",{p_token:token,p_confirm:true}).abortSignal(signal());
 if(error) throw new Error(databaseError(error));
 return data as {removed:number;remaining:number;errors:number};
}
