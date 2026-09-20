"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { saveArticle, deleteArticle, saveCategory, deleteCategory } from "@/lib/journal/mutations";
import type { MutationState } from "@/lib/journal/types";

function refreshJournal() {
  revalidatePath("/", "layout");
}
export async function saveArticleAction(id: string | null, _state: MutationState, form: FormData): Promise<MutationState> {
  let result: MutationState;
  try { result = await saveArticle(await createClient(), id, form); }
  catch { return { error: "Unable to save. Please try again." }; }
  if (!result.success) return result;
  refreshJournal();
  redirect("/admin/articles?notice=saved");
}
export async function deleteArticleAction(id: string, _state: MutationState, form: FormData): Promise<MutationState> {
  let result: MutationState;
  try { result = await deleteArticle(await createClient(), id, form); }
  catch { return { error: "Unable to delete. Please try again." }; }
  if (result.success) refreshJournal();
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
