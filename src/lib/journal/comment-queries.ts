import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PublicComment } from "./types";
import { readQuery } from "./read-query";

export async function getApprovedComments(articleId: string): Promise<PublicComment[]> {
  const client = await createClient();

  const { data, error } = await readQuery(
    (signal) =>
      client
        .from("comments")
        .select("id, article_id, name, content, created_at")
        .eq("article_id", articleId)
        .eq("status", "approved")
        .order("created_at", { ascending: true })
        .abortSignal(signal),
    "Comments are temporarily unavailable."
  );

  if (error) {
    throw new Error("Comments are temporarily unavailable.");
  }

  return (data ?? []).map((comment) => ({
    id: comment.id,
    articleId: comment.article_id,
    name: comment.name,
    content: comment.content,
    createdAt: comment.created_at,
  }));
}