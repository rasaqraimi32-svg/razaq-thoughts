import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/admin";
import { articleColumns, type ArticleRecord, type Category } from "./types";
import { uuidPattern } from "./validation";
import { readQuery } from "./read-query";

export function pageNumber(value: string | undefined) {
  const page = Number(value); return Number.isInteger(page) && page > 0 && page <= 100000 ? page : 1;
}
export const getCategories = cache(async (): Promise<Category[]> => {
  const client = await createClient();
  const { data } = await readQuery(signal => client.from("categories").select("id,name,slug").order("name").abortSignal(signal), "Categories are temporarily unavailable.");
  return data ?? [];
});
export async function getAdminArticles(page = 1) {
  await requireAdmin(); const client = await createClient();
  const { data, count } = await readQuery(signal => client.from("articles").select(articleColumns, { count: "exact" }).order("updated_at", { ascending: false }).order("id").range((page - 1) * 30, page * 30 - 1).abortSignal(signal), "Articles are temporarily unavailable.");
  return { articles: (data ?? []) as unknown as ArticleRecord[], count: count ?? 0 };
}
export async function getAdminArticle(id: string) {
  await requireAdmin(); if (!uuidPattern.test(id)) return null;
  const client = await createClient();
  const { data } = await readQuery(signal => client.from("articles").select(articleColumns).eq("id", id).abortSignal(signal).maybeSingle(), "The article could not be loaded.");
  return data as unknown as ArticleRecord | null;
}
export async function getDashboardCounts() {
  await requireAdmin();

  const client = await createClient();

  const results = await Promise.all([
    client.from("articles").select("id", { count: "exact", head: true }),

    ...["published", "draft", "archived"].map((status) =>
      client
        .from("articles")
        .select("id", { count: "exact", head: true })
        .eq("status", status),
    ),

    client.from("categories").select("id", { count: "exact", head: true }),

    client
      .from("comments")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
  ].map((query) =>
    readQuery(
      (signal) => query.abortSignal(signal),
      "Dashboard counts are temporarily unavailable.",
    ),
  ));

  return results.map((result) => result.count ?? 0);
}
