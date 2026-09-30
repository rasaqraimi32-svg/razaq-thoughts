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
