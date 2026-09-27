import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminAccess } from "@/lib/supabase/admin-access";
import { saveArticleWithCover, deleteArticleWithCover } from "./cover-mutations";
import { uuidPattern } from "./validation";
import { PDF_BUCKET, reviewedFields, validatePdf, type ReviewedWork } from "./reviewed-work";
import { removeUnusedPdf } from "./reviewed-work-storage";
import type { MutationState } from "./types";
const denied = { error: "Administrator access is required. Please sign in again." };
const failure = { error: "The reviewed work could not be saved. Please reload and try again." };
const cleanupWarning = "An unused PDF could not be removed. Use PDF maintenance after 24 hours to retry cleanup.";

export async function prepareArticleWithReviewedWork(client: SupabaseClient, id: string | null, form: FormData): Promise<MutationState> {
  if ((await getAdminAccess(client)).status !== "admin") return denied;
  if (id !== null && !uuidPattern.test(id)) return { error: "Article not found." };
  const fields = reviewedFields(form);
  if (Object.keys(fields.errors).length) return { errors: fields.errors };
  // Check availability and the reviewed-work version before changing article data.
  const query = client.from("article_reviewed_works").select("updated_at");
  const previous = await (id ? query.eq("article_id", id) : query.limit(0)).maybeSingle();
  if (previous.error) return { error: "Reviewed-work storage is unavailable. Apply the Phase 3 migration before attaching a PDF." };
  if ((previous.data?.updated_at ?? "none") !== fields.version) return { error: "The reviewed work changed. Reload before saving." };
  return saveArticleWithCover(client, id, form);
}

export async function saveReviewedWork(client: SupabaseClient, articleId: string, form: FormData): Promise<MutationState> {
  if ((await getAdminAccess(client)).status !== "admin") return denied;
  if (!uuidPattern.test(articleId)) return { error: "Article not found." };
  const fields = reviewedFields(form);
  if (Object.keys(fields.errors).length) return { errors: fields.errors };
  let uploadedPath: string | null = null;
  try {
    const article = await client.from("articles").select("id").eq("id", articleId).maybeSingle();
    if (article.error || !article.data) return { error: "The article is unavailable. Reload before attaching a PDF." };
    const previous = await client.from("article_reviewed_works").select("id,updated_at,pdf_storage_path").eq("article_id", articleId).maybeSingle();
    if (previous.error) return failure;
    const old = previous.data as Pick<ReviewedWork, "id" | "updated_at" | "pdf_storage_path"> | null;
    if ((old?.updated_at ?? "none") !== fields.version) return { error: "The reviewed work changed in another editor. Reload before saving." };
    if (fields.intent === "remove") {
      if (!old) return { success: "No reviewed work attached." };
      const result = await client.from("article_reviewed_works").delete().eq("id", old.id).eq("updated_at", old.updated_at).select("id").maybeSingle();
      if (result.error || !result.data) return failure;
      const cleaned = await removeUnusedPdf(client, old.pdf_storage_path);
      return { success: "Reviewed work removed.", ...(cleaned ? {} : { error: cleanupWarning }) };
    }
    if (!fields.active) return { success: "No reviewed work attached." };
    let filename: string | undefined;
    if (fields.intent === "replace") {
      const file = form.get("reviewed_pdf");
      if (!(file instanceof File)) return { errors: { reviewed_pdf: "Choose the PDF again before saving." } };
      let pdf;
      try { pdf = await validatePdf(file); }
      catch (error) { return { errors: { reviewed_pdf: error instanceof Error ? error.message : "Invalid PDF." } }; }
      uploadedPath = articleId + "/" + randomUUID() + ".pdf";
      filename = pdf.filename;
      const upload = await client.storage.from(PDF_BUCKET).upload(uploadedPath, pdf.bytes, { contentType: "application/pdf", cacheControl: "0", upsert: false });
      if (upload.error) throw new Error();
    }
    if (!old && !uploadedPath) return { errors: { reviewed_pdf: "Choose a PDF for this reviewed work." } };
    const values = { title: fields.title, author_name: fields.author_name, ...(uploadedPath ? { pdf_storage_path: uploadedPath, pdf_original_filename: filename } : {}) };
    const query = old ? client.from("article_reviewed_works").update(values).eq("id", old.id).eq("updated_at", old.updated_at) : client.from("article_reviewed_works").insert({ ...values, article_id: articleId });
    const result = await query.select("id").maybeSingle();
    if (result.error || !result.data) throw new Error();
    // Confirm the row first. The old PDF remains intact through all earlier steps.
    if (uploadedPath && old && !await removeUnusedPdf(client, old.pdf_storage_path)) return { success: "Reviewed work saved.", error: cleanupWarning };
    return { success: "Reviewed work saved." };
  } catch {
    const cleaned = !uploadedPath || await removeUnusedPdf(client, uploadedPath);
    return { error: failure.error + (cleaned ? "" : " " + cleanupWarning) };
  }
}

export async function deleteArticleWithReviewedPdf(client: SupabaseClient, id: string, form: FormData): Promise<MutationState> {
  if ((await getAdminAccess(client)).status !== "admin") return denied;
  if (!uuidPattern.test(id) || form.get("confirm") !== "yes") return deleteArticleWithCover(client, id, form);
  // The FK cascades the bibliographic row; bytes must be removed via Storage API.
  const previous = await client.from("article_reviewed_works").select("pdf_storage_path").eq("article_id", id).maybeSingle();
  const result = await deleteArticleWithCover(client, id, form);
  if (!result.success) return result;
  const missingMigration = ["42P01", "PGRST205"].includes(previous.error?.code ?? "");
  if ((previous.error && !missingMigration) || (previous.data && !await removeUnusedPdf(client, previous.data.pdf_storage_path))) return { ...result, error: [result.error, cleanupWarning].filter(Boolean).join(" ") };
  return result;
}
