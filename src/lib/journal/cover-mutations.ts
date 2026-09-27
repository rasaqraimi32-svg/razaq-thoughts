import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminAccess } from "@/lib/supabase/admin-access";
import { saveArticle, deleteArticle } from "./mutations";
import { validateArticle, uuidPattern } from "./validation";
import { validateCover } from "./cover-validation";
import { COVER_BUCKET } from "./cover-settings";
import { coverUrl, removeUnusedCover } from "./cover-storage";
import type { MutationState } from "./types";

const denied = { error: "Administrator access is required. Please sign in again." };
const cleanupWarning = "An unused image could not be removed. Use Clean up unused images on the Articles screen after 24 hours.";
export async function saveArticleWithCover(client: SupabaseClient, id: string | null, form: FormData): Promise<MutationState> {
  if ((await getAdminAccess(client)).status !== "admin") return denied;
  if (id !== null && !uuidPattern.test(id)) return { error: "Article not found." };
  let oldUrl: string | null = null;
  if (id) {
    const previous = await client.from("articles").select("cover_image_url,updated_at").eq("id", id).maybeSingle();
    if (previous.error || !previous.data) return { error: "Unable to load the article. Reload before saving." };
    if (previous.data.updated_at !== form.get("updated_at")) return { error: "This article changed. Reload before saving." };
    oldUrl = previous.data.cover_image_url;
  }
  const intent = form.get("cover_intent") ?? "keep";
  if (!["keep", "remove", "replace"].includes(String(intent))) return { error: "Invalid image selection. Please choose the image again." };
  // Never trust a URL or storage path supplied by the browser.
  form.set("cover_image_url", intent === "remove" ? "" : oldUrl ?? "");
  const { errors } = validateArticle(form, id !== null);
  if (Object.keys(errors).length) return { errors, error: "Please correct the highlighted fields." };
  let uploadedUrl: string | null = null;
  if (intent === "replace") {
    const file = form.get("cover_file");
    if (!(file instanceof File) || !file.size) return { errors: { cover_file: "Choose the image again before saving." } };
    let image;
    try { image = await validateCover(file); }
    catch (error) { return { errors: { cover_file: error instanceof Error ? error.message : "Invalid image." } }; }
    const path = "uploads/" + randomUUID() + "." + image.extension;
    uploadedUrl = coverUrl(path);
    try {
      const upload = await client.storage.from(COVER_BUCKET).upload(path, image.bytes, { contentType: image.contentType, cacheControl: "3600", upsert: false });
      if (upload.error) throw new Error();
    } catch {
      const cleaned = await removeUnusedCover(client, uploadedUrl);
      return { error: "The image could not be uploaded. Check that article-covers Storage is configured, then try again." + (cleaned ? "" : " " + cleanupWarning) };
    }
    form.set("cover_image_url", uploadedUrl);
  }
  let result: MutationState;
  try { result = await saveArticle(client, id, form); }
  catch { result = { error: "Unable to save this article. Please try again." }; }
  if (!result.success) {
    if (uploadedUrl && !await removeUnusedCover(client, uploadedUrl)) return { ...result, error: (result.error ?? "The article was not saved.") + " " + cleanupWarning };
    return result;
  }
  if (oldUrl !== form.get("cover_image_url") && !await removeUnusedCover(client, oldUrl)) return { ...result, error: cleanupWarning };
  return result;
}

export async function deleteArticleWithCover(client: SupabaseClient, id: string, form: FormData): Promise<MutationState> {
  if ((await getAdminAccess(client)).status !== "admin") return denied;
  if (!uuidPattern.test(id) || form.get("confirm") !== "yes") return deleteArticle(client, id, form);
  const previous = await client.from("articles").select("cover_image_url").eq("id", id).maybeSingle();
  if (previous.error) return { error: "Unable to load the article before deletion. Please try again." };
  const result = await deleteArticle(client, id, form);
  if (result.success && !await removeUnusedCover(client, previous.data?.cover_image_url)) return { ...result, error: cleanupWarning };
  return result;
}
