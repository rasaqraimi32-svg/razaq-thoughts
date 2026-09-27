import { reviewedFields, validatePdf } from "./reviewed-work";
import type { MutationState } from "./types";
type SaveStep = (form: FormData) => Promise<MutationState>;
// Two bounded requests: the existing article/cover save, then the optional PDF.
export async function submitReviewedArticle(form: FormData, saveArticle: SaveStep, savePdf: (id: string, form: FormData) => Promise<MutationState>, stage: (message: string) => void): Promise<MutationState> {
  const fields = reviewedFields(form);
  if (Object.keys(fields.errors).length) return { errors: fields.errors };
  const pdfForm = new FormData();
  for (const key of ["reviewed_title", "reviewed_author", "reviewed_intent", "reviewed_version", "reviewed_pdf"]) {
    const value = form.get(key); if (value !== null) pdfForm.set(key, value);
  }
  if (fields.intent === "replace") {
    try {
      const file = pdfForm.get("reviewed_pdf");
      if (!(file instanceof File)) throw new Error("Choose a PDF before saving.");
      await validatePdf(file); // Fast preflight; server repeats this after authorization.
    } catch (error) { return { errors: { reviewed_pdf: error instanceof Error ? error.message : "Invalid PDF." } }; }
  }
  form.delete("reviewed_pdf");
  stage("Saving article and front-page image…");
  const article = await saveArticle(form);
  if (!article.success || !article.id) return article;
  stage("Saving the work under review and its PDF…");
  let pdf: MutationState;
  try { pdf = await savePdf(article.id, pdfForm); }
  catch { pdf = { error: "The PDF request was interrupted. Reopen the saved article to check and retry." }; }
  const error = [article.error, pdf.error, ...Object.values(pdf.errors ?? {})].filter(Boolean).join(" ");
  return { id: article.id, success: "Article saved.", ...(error ? { error } : !pdf.success ? { error: "The PDF was not saved. Reopen the saved article to retry." } : {}) };
}
