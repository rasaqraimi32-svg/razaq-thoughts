import "server-only";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/admin";
import { readQuery } from "./read-query";
import type { AdminComment } from "./types";

type CommentRow = {
  id: string;
  article_id: string;
  name: string;
  email: string;
  content: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

type ArticleRow = {
  id: string;
  title: string;
  slug: string;
};

export async function getAdminComments(): Promise<AdminComment[]> {
  await requireAdmin();

  const client = await createClient();

  const { data: commentRows } = await readQuery(
    (signal) =>
      client
        .rpc("get_admin_comments", {
          p_limit: 100,
          p_offset: 0,
        })
        .abortSignal(signal),
    "Comments are temporarily unavailable.",
  );

  const comments = (commentRows ?? []) as CommentRow[];

  if (!comments.length) {
    return [];
  }

  const articleIds = [...new Set(comments.map((comment) => comment.article_id))];

  const { data: articleRows } = await readQuery(
    (signal) =>
      client
        .from("articles")
        .select("id,title,slug")
        .in("id", articleIds)
        .abortSignal(signal),
    "The related articles could not be loaded.",
  );

  const articles = (articleRows ?? []) as ArticleRow[];
  const articleMap = new Map(
    articles.map((article) => [article.id, article]),
  );

  return comments.map((comment) => {
    const article = articleMap.get(comment.article_id);

    return {
      id: comment.id,
      articleId: comment.article_id,
      name: comment.name,
      email: comment.email,
      content: comment.content,
      status: comment.status,
      createdAt: comment.created_at,
      articleTitle: article?.title ?? "Unknown article",
      articleSlug: article?.slug ?? "",
    };
  });
}