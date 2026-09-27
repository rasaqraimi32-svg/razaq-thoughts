export const PDF_BUCKET = "article-reviewed-pdfs";
export const MAX_PDF_BYTES = 3 * 1024 * 1024;
export const pdfPathPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/;
export type ReviewedWork = {
  id: string; article_id: string; title: string; author_name: string;
  pdf_storage_path: string; pdf_original_filename: string; created_at: string; updated_at: string;
};
export const reviewedWorkColumns = "id,article_id,title,author_name,pdf_storage_path,pdf_original_filename,created_at,updated_at";
export function safePdfFilename(value: string) {
  const base = Array.from(value.replace(/[\\/\x00-\x1f\x7f"<>:|?*]/g, "_").replace(/\.pdf$/i, "").trim()).slice(0, 170).join("");
  return (base || "reviewed-work") + ".pdf";
}
export function reviewedFields(form: FormData) {
  const text = (key: string) => typeof form.get(key) === "string" ? String(form.get(key)).trim() : "";
  const title = text("reviewed_title"), author_name = text("reviewed_author");
  const intent = text("reviewed_intent") || "keep";
  const version = text("reviewed_version") || "none";
  const errors: Record<string, string> = {};
  if (!["keep", "replace", "remove"].includes(intent)) errors.reviewed_work = "Choose a valid reviewed-work action.";
  const active = intent !== "remove" && (intent === "replace" || version !== "none" || Boolean(title || author_name));
  if (active && (!title || title.length > 300)) errors.reviewed_title = "Enter the original work’s title (up to 300 characters).";
  if (active && (!author_name || author_name.length > 200)) errors.reviewed_author = "Enter the original author’s name (up to 200 characters).";
  if (active && version === "none" && intent !== "replace") errors.reviewed_pdf = "Choose a PDF for the work under review, or clear its title and author.";
  return { intent, version, title, author_name, active, errors };
}
export async function validatePdf(file: File) {
  if (!file.size || file.size > MAX_PDF_BYTES) throw new Error("Choose a PDF between 1 byte and 3 MB.");
  if (!/\.pdf$/i.test(file.name) || (file.type && file.type !== "application/pdf")) throw new Error("Choose a PDF file. Images, Word documents and other files are not supported.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const header = new TextDecoder().decode(bytes.subarray(0, 9));
  const tail = new TextDecoder().decode(bytes.subarray(Math.max(0, bytes.length - 1024)));
  if (!/^%PDF-(?:1\.[0-7]|2\.0)[\r\n\s]/.test(header) || !/%%EOF\s*$/.test(tail)) throw new Error("This file does not have a valid PDF signature and ending. Choose the original PDF again.");
  return { bytes, filename: safePdfFilename(file.name) };
}
