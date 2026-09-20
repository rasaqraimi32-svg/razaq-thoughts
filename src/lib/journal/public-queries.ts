import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { articleColumns, toPublicArticle, type ArticleRecord } from "./types";
import { slugPattern } from "./validation";
import { readQuery } from "./read-query";

// Explicit filters are required even for an administrator browsing the public site.
// RLS independently protects anonymous and other authenticated readers.
export async function getPublishedArticles(page = 1, limit = 12, featured = false) {
  const client = await createClient();
  let query = client.from("articles").select(articleColumns, { count: "exact" }).eq("status", "published");
  if (featured) query = query.eq("featured", true);
  const { data, count } = await readQuery(signal => query.order("published_at", { ascending: false }).order("id").range((page - 1) * limit, page * limit - 1).abortSignal(signal), "Articles are temporarily unavailable.");
  return { articles: ((data ?? []) as unknown as ArticleRecord[]).map(toPublicArticle), count: count ?? 0 };
}
export const getPublishedArticle = cache(async (slug: string) => {
  if (!slugPattern.test(slug) || slug.length > 180) return null;
  const client = await createClient();
  const { data } = await readQuery(signal => client.from("articles").select(articleColumns).eq("status", "published").eq("slug", slug).abortSignal(signal).maybeSingle(), "The article is temporarily unavailable.");
  return data ? toPublicArticle(data as unknown as ArticleRecord) : null;
});
