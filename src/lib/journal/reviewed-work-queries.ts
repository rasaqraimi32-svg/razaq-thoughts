import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/admin";
import { readQuery } from "./read-query";
import { reviewedWorkColumns, type ReviewedWork } from "./reviewed-work";

export async function getAdminReviewedWork(articleId: string | null) {
  await requireAdmin();
  try {
    const client = await createClient();
    const query = client.from("article_reviewed_works").select(reviewedWorkColumns);
    const { data } = await readQuery(signal => (articleId ? query.eq("article_id", articleId) : query.limit(0)).abortSignal(signal).maybeSingle(), "Reviewed works are temporarily unavailable.");
    return { work: data as ReviewedWork | null, available: true };
  } catch { return { work: null, available: false }; }
}
export async function findPublishedReviewedWork(client: SupabaseClient, articleId: string) {
  // Explicit status check also applies to administrators browsing the public page.
  const article = await readQuery(signal => client.from("articles").select("id").eq("id", articleId).eq("status", "published").abortSignal(signal).maybeSingle(), "Reviewed work unavailable.");
  if (!article.data) return null;
  const { data } = await readQuery(signal => client.from("article_reviewed_works").select(reviewedWorkColumns).eq("article_id", articleId).abortSignal(signal).maybeSingle(), "Reviewed work unavailable.");
  return data as ReviewedWork | null;
}
export async function getPublishedReviewedWork(articleId: string) {
  return findPublishedReviewedWork(await createClient(), articleId);
}
