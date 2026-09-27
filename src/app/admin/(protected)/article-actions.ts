"use server";
import { deleteArticleWithReviewedPdf } from "@/lib/journal/reviewed-work-mutations";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { saveCategory, deleteCategory } from "@/lib/journal/mutations";
import { saveArticleWithCover } from "@/lib/journal/cover-mutations";
import { cleanupUnusedCovers } from "@/lib/journal/cover-storage";
import type { MutationState } from "@/lib/journal/types";

function refreshJournal() {
  revalidatePath("/", "layout");
}
export async function saveArticleAction(id: string | null, _state: MutationState, form: FormData): Promise<MutationState> {
  let result: MutationState;
  try { result = await saveArticleWithCover(await createClient(), id, form); }
  catch { return { error: "Unable to save. Please try again." }; }
  if (!result.success) return result;
  refreshJournal();
  redirect(result.error ? "/admin/articles?notice=cover-cleanup" : "/admin/articles?notice=saved");
}
export async function deleteArticleAction(id: string, _state: MutationState, form: FormData): Promise<MutationState> {
  let result: MutationState;
  try { result = await deleteArticleWithReviewedPdf(await createClient(), id, form); }
  catch { return { error: "Unable to delete. Please try again." }; }
  if (result.success) {
    refreshJournal();
    if (result.error) redirect("/admin/articles?notice=cover-delete-cleanup");
  }
  return result;
}
export async function saveCategoryAction(id: string | null, _state: MutationState, form: FormData): Promise<MutationState> {
  let result: MutationState;
  try { result = await saveCategory(await createClient(), id, form); }
  catch { return { error: "Unable to save. Please try again." }; }
  if (result.success) refreshJournal();
  return result;
}
export async function deleteCategoryAction(id: string, _state: MutationState, form: FormData): Promise<MutationState> {
  let result: MutationState;
  try { result = await deleteCategory(await createClient(), id, form); }
  catch { return { error: "Unable to delete. Please try again." }; }
  if (result.success) refreshJournal();
  return result;
}

export async function cleanupCoverImagesAction(): Promise<MutationState> {
  try { return await cleanupUnusedCovers(await createClient()); }
  catch { return { error: "Unable to clean up images. Please retry later." }; }
}
