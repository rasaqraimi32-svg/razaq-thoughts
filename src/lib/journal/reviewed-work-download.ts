import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { findPublishedReviewedWork } from "./reviewed-work-queries";
import { PDF_BUCKET, MAX_PDF_BYTES, pdfPathPattern, safePdfFilename } from "./reviewed-work";
import { slugPattern } from "./validation";
import { readQuery } from "./read-query";
export function pdfDisposition(filename: string, download: boolean) {
  const safe = safePdfFilename(filename);
  const ascii = safe.replace(/[^a-zA-Z0-9._ -]/g, "_");
  const encoded = encodeURIComponent(safe).replace(/['()*]/g, char => "%" + char.charCodeAt(0).toString(16).toUpperCase());
  return (download ? "attachment" : "inline") + '; filename="' + ascii + '"; filename*=UTF-8\'\'' + encoded;
}
export async function serveReviewedPdf(client: SupabaseClient, slug: string, download: boolean) {
  const headers = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" };
  if (!slugPattern.test(slug) || slug.length > 180) return new Response("Not found", { status: 404, headers });
  try {
    const article = await readQuery(signal => client.from("articles").select("id").eq("slug", slug).eq("status", "published").abortSignal(signal).maybeSingle(), "PDF unavailable.");
    const work = article.data ? await findPublishedReviewedWork(client, article.data.id) : null;
    if (!work || !pdfPathPattern.test(work.pdf_storage_path) || !work.pdf_storage_path.startsWith(work.article_id + "/")) return new Response("Not found", { status: 404, headers });
    const file = await client.storage.from(PDF_BUCKET).download(work.pdf_storage_path);
    if (file.error || !file.data) return new Response("PDF temporarily unavailable", { status: 503, headers });
    if (file.data.size > MAX_PDF_BYTES) return new Response("PDF unavailable", { status: 503, headers });
    return new Response(file.data, { headers: { ...headers, "Content-Type": "application/pdf", "Content-Disposition": pdfDisposition(work.pdf_original_filename, download), "Content-Length": String(file.data.size) } });
  } catch { return new Response("PDF temporarily unavailable", { status: 503, headers }); }
}
