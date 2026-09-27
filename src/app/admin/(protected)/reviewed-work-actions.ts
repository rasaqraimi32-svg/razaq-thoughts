"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { prepareArticleWithReviewedWork, saveReviewedWork } from "@/lib/journal/reviewed-work-mutations";
import { cleanupReviewedPdfs } from "@/lib/journal/reviewed-work-storage";
import type { MutationState } from "@/lib/journal/types";
export async function saveArticleForReviewAction(id: string | null, form: FormData): Promise<MutationState> {
  try {
    const result = await prepareArticleWithReviewedWork(await createClient(), id, form);
    if (result.success) revalidatePath("/", "layout");
    return result;
  } catch { return { error: "The article could not be saved. Please try again." }; }
}
export async function saveReviewedWorkAction(id: string, form: FormData): Promise<MutationState> {
  try {
    const result = await saveReviewedWork(await createClient(), id, form);
    if (result.success) revalidatePath("/", "layout");
    return result;
  } catch { return { error: "The PDF step could not be completed. Reopen the saved article to retry." }; }
}
export async function cleanupReviewedPdfsAction(): Promise<MutationState> {
  try { return await cleanupReviewedPdfs(await createClient()); }
  catch { return { error: "PDF cleanup is unavailable. Please retry later." }; }
}
