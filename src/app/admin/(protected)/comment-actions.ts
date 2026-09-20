"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/admin";
import { uuidPattern } from "@/lib/journal/validation";

const denied = {
  error: "Administrator access is required. Please sign in again.",
};

function refreshComments() {
  revalidatePath("/admin/comments");
  revalidatePath("/", "layout");
}

async function authorize() {
  try {
    await requireAdmin();
    return true;
  } catch {
    return false;
  }
}

async function updateCommentStatus(
  id: string,
  status: "approved" | "rejected",
) {
  if (!await authorize()) return denied;

  if (!uuidPattern.test(id)) {
    return { error: "Comment not found." };
  }

  try {
    const client = await createClient();

    const result = await client
      .from("comments")
      .update({ status })
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (result.error) {
      return {
        error: "Unable to update this comment. Please try again.",
      };
    }

    if (!result.data) {
      return {
        error: "This comment is no longer available.",
      };
    }

    refreshComments();

    return {
      success:
        status === "approved"
          ? "Comment approved."
          : "Comment rejected.",
    };
  } catch {
    return {
      error: "Unable to update this comment. Please try again.",
    };
  }
}

export async function approveCommentAction(
  id: string,
  _form: FormData,
): Promise<void> {
  await updateCommentStatus(id, "approved");
}

export async function rejectCommentAction(
  id: string,
  _form: FormData,
): Promise<void> {
  await updateCommentStatus(id, "rejected");
}

export async function deleteCommentAction(
  id: string,
  form: FormData,
): Promise<void> {
  if (!await authorize()) return;

  if (!uuidPattern.test(id)) return;

  if (form.get("confirm") !== "yes") return;

  try {
    const client = await createClient();

    const result = await client
      .from("comments")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (result.error || !result.data) return;

    refreshComments();
  } catch {
    return;
  }
}