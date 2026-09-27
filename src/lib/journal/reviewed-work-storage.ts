import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminAccess } from "@/lib/supabase/admin-access";
import type { MutationState } from "./types";
import { PDF_BUCKET, pdfPathPattern } from "./reviewed-work";
export async function removeUnusedPdf(client: SupabaseClient, path: string) {
  if (!pdfPathPattern.test(path)) return false;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const refs = await client.from("article_reviewed_works").select("id", { count: "exact", head: true }).eq("pdf_storage_path", path);
      if (refs.error || refs.count === null) continue;
      if (refs.count > 0) return true;
      const result = await client.storage.from(PDF_BUCKET).remove([path]);
      if (!result.error && result.data?.some(object => object.name === path)) return true;
      const [folder, name] = path.split("/");
      const listed = await client.storage.from(PDF_BUCKET).list(folder, { search: name, limit: 2 });
      if (!listed.error && listed.data && !listed.data.some(object => object.name === name)) return true;
    } catch { /* Preserve files when reference checks fail; retry transient outages. */ }
  }
  return false;
}
export async function cleanupReviewedPdfs(client: SupabaseClient): Promise<MutationState> {
  if ((await getAdminAccess(client)).status !== "admin") return { error: "Administrator access is required." };
  try {
    const result = await client.rpc("get_unused_reviewed_pdf_paths");
    if (result.error || !result.data) return { error: "PDF cleanup is unavailable. Check the Phase 3 migration and retry." };
    for (const item of result.data as { path: string }[]) if (!await removeUnusedPdf(client, item.path)) return { error: "Some unused PDFs could not be removed. Please retry later." };
    return { success: "PDF cleanup complete. Referenced files and uploads from the last 24 hours were preserved." + (result.data.length === 100 ? " Run cleanup again to check the next batch." : "") };
  } catch { return { error: "PDF cleanup is temporarily unavailable. Please retry later." }; }
}
