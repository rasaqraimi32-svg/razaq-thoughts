"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { uuidPattern } from "@/lib/journal/validation";
import { cleanupSimulation, discoverSimulationArticles, seedSimulationArticle, simulationSnapshot } from "@/lib/journal/comment-simulation";

export async function discoverSimulationAction() {
 await requireAdmin();
 const client = await createClient();
 await simulationSnapshot(client); // Fail early when migration is missing.
 const articles = await discoverSimulationArticles(client);
 return articles.map(({id,title})=>({id,title}));
}
export async function seedSimulationAction(id: string, confirmed: boolean) {
 await requireAdmin();
 if(confirmed !== true || !uuidPattern.test(id)) throw new Error("Valid article and confirmation required.");
 const result = await seedSimulationArticle(await createClient(),id);
 if(result.status === "seeded") { revalidatePath("/admin/comments"); revalidatePath("/articles/[slug]","page"); }
 return result;
}
export async function previewSimulationCleanupAction() {
 await requireAdmin();
 return simulationSnapshot(await createClient());
}
export async function removeSimulationAction(token: string, confirmed: boolean) {
 await requireAdmin();
 if(confirmed !== true || !/^[a-f0-9]{32}$/.test(token)) throw new Error("Preview and confirmation required.");
 const result = await cleanupSimulation(await createClient(),token);
 revalidatePath("/admin/comments"); revalidatePath("/articles/[slug]","page");
 return result;
}

export async function inspectNewSimulationAction() {
 await requireAdmin();
 const { inspectNewSimulationArticles } = await import("@/lib/journal/new-comment-simulation");
 return inspectNewSimulationArticles(await createClient());
}
export async function prepareNewSimulationAction(id:string,text:string) {
 await requireAdmin();
 if(!uuidPattern.test(id)||typeof text!=="string"||text.length>75000)return {error:"Invalid article or oversized dataset."};
 try {
  const {prepareNewSimulation}=await import("@/lib/journal/new-comment-simulation");
  let input:unknown;try{input=JSON.parse(text);}catch{return {error:"The prepared dataset must be valid JSON."};}
  return {result:await prepareNewSimulation(await createClient(),id,input)};
 } catch(error) { return {error:error instanceof Error?error.message:"Unable to prepare preview."}; }
}
export async function confirmNewSimulationAction(id:string,confirmed:boolean) {
 await requireAdmin();
 if(confirmed!==true||!uuidPattern.test(id))return {error:"Preview and explicit confirmation required."};
 try {
  const {confirmNewSimulation}=await import("@/lib/journal/new-comment-simulation");
  const result=await confirmNewSimulation(await createClient(),id);
  if(result.status==="seeded"){revalidatePath("/admin/comments");revalidatePath("/articles/[slug]","page");}
  return {result};
 } catch(error) {return {error:error instanceof Error?error.message:"Confirmation failed; inspect again before retrying."};}
}
