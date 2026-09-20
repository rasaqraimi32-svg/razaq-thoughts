"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { uuidPattern } from "@/lib/journal/validation";
import type { MutationState } from "@/lib/journal/types";

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export async function submitCommentAction(
  articleId: string,
  slug: string,
  _state: MutationState,
  form: FormData,
): Promise<MutationState> {
  if (!uuidPattern.test(articleId)) {
    return { error: "This article is not available for comments." };
  }

  const name = clean(form.get("name"));
  const email = clean(form.get("email"));
  const content = clean(form.get("content"));

  const errors: Record<string, string> = {};

  if (!name) {
    errors.name = "Please enter your name.";
  } else if (name.length > 100) {
    errors.name = "Your name is too long.";
  }

  if (!email) {
    errors.email = "Please enter your email address.";
  } else if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    errors.email = "Please enter a valid email address.";
  }

  if (!content) {
    errors.content = "Please enter a comment.";
  } else if (content.length > 2000) {
    errors.content = "Your comment is too long. Please keep it under 2,000 characters.";
  }

  if (Object.keys(errors).length) {
    return {
      errors,
      error: "Please correct the highlighted fields.",
    };
  }

  try {
    const client = await createClient();

    const article = await client
      .from("articles")
      .select("id")
      .eq("id", articleId)
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();

    if (article.error || !article.data) {
      return { error: "This article is not available for comments." };
    }

    const result = await client
      .from("comments")
      .insert({
        article_id: articleId,
        name,
        email,
        content,
      });

    if (result.error) {
      return { error: "We could not submit your comment. Please try again." };
    }

    revalidatePath(`/articles/${slug}`);

    return {
      success: "Thank you. Your comment has been submitted for review.",
    };
  } catch {
    return {
      error: "We could not submit your comment. Please try again.",
    };
  }
}