import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminAccess } from "@/lib/supabase/admin-access";
import { text, uuidPattern, validateArticle, validateCategory } from "./validation";
import type { MutationState } from "./types";

async function authorize(client: SupabaseClient) {
  return (await getAdminAccess(client)).status === "admin";
}
const denied = { error: "Administrator access is required. Please sign in again." };
const failure = { error: "We could not save this change. Please try again." };

export async function saveArticle(client: SupabaseClient, id: string | null, form: FormData): Promise<MutationState> {
  if (!await authorize(client)) return denied;
  if (id !== null && !uuidPattern.test(id)) return { error: "Article not found." };
  const { errors, values, autoSlug } = validateArticle(form, id !== null);
  if (Object.keys(errors).length) return { errors, error: "Please correct the highlighted fields." };
  try {
    const category = await client.from("categories").select("id").eq("id", values.category_id).maybeSingle();
    if (category.error) return failure;
    if (!category.data) return { errors: { category_id: "This category no longer exists. Choose another." } };
    if (id) {
      const version = text(form, "updated_at");
      if (!version || !Number.isFinite(Date.parse(version))) return { error: "Reload the article before saving." };
      // The database trigger updates updated_at and sets the first publication date.
      // Omitting published_at preserves the original date when unpublishing/republishing.
      const result = await client.from("articles").update(values).eq("id", id).eq("updated_at", version).select("id").maybeSingle();
      if (result.error?.code === "23505") return { errors: { slug: "This slug is already in use. Choose another." } };
      if (result.error?.code === "23503") return { errors: { category_id: "This category no longer exists." } };
      if (result.error) return failure;
      if (!result.data) return { error: "This article changed or was deleted. Reload it before saving to avoid overwriting another edit." };
      return { id: result.data.id, success: "Article saved." };
    }
    // The unique index is authoritative, even when two submissions happen together.
    for (let attempt = 0; attempt < (autoSlug ? 20 : 1); attempt++) {
      const slug = attempt ? values.slug + "-" + (attempt + 1) : values.slug;
      const result = await client.from("articles").insert({ ...values, slug }).select("id").single();
      if (result.error?.code === "23505") {
        if (autoSlug) continue;
        return { errors: { slug: "This slug is already in use. Choose another." } };
      }
      if (result.error?.code === "23503") return { errors: { category_id: "This category no longer exists." } };
      if (result.error || !result.data) return failure;
      return { id: result.data.id, success: "Article created." };
    }
    return { errors: { slug: "Choose a different slug; this title has many existing variations." } };
  } catch { return failure; }
}

export async function deleteArticle(client: SupabaseClient, id: string, form: FormData): Promise<MutationState> {
  if (!await authorize(client)) return denied;
  if (!uuidPattern.test(id)) return { error: "Article not found." };
  if (form.get("confirm") !== "yes") return { error: "Confirm the permanent deletion first." };
  try {
    const result = await client.from("articles").delete().eq("id", id).select("id").maybeSingle();
    if (result.error) return { error: "Unable to delete this article. Please try again." };
    if (!result.data) return { error: "This article has already been deleted or is unavailable." };
    return { success: "Article deleted." };
  } catch { return failure; }
}

export async function saveCategory(client: SupabaseClient, id: string | null, form: FormData): Promise<MutationState> {
  if (!await authorize(client)) return denied;
  if (id !== null && !uuidPattern.test(id)) return { error: "Category not found." };
  const { errors, values } = validateCategory(form);
  if (Object.keys(errors).length) return { errors, error: "Please correct the highlighted fields." };
  try {
    const query = id ? client.from("categories").update(values).eq("id", id) : client.from("categories").insert(values);
    const result = await query.select("id").maybeSingle();
    if (result.error?.code === "23505") return { error: "A category with this name or slug already exists." };
    if (result.error) return failure;
    if (!result.data) return { error: "This category is no longer available." };
    return { id: result.data.id, success: "Category saved." };
  } catch { return failure; }
}

export async function deleteCategory(client: SupabaseClient, id: string, form: FormData): Promise<MutationState> {
  if (!await authorize(client)) return denied;
  if (!uuidPattern.test(id)) return { error: "Category not found." };
  if (form.get("confirm") !== "yes") return { error: "Confirm the deletion first." };
  try {
    const usage = await client.from("articles").select("id", { count: "exact", head: true }).eq("category_id", id);
    if (usage.error) return failure;
    if (usage.count === null || usage.count > 0) return { error: "This category is used by articles. Reassign those articles before deleting it." };
    // The RESTRICT foreign key also protects against concurrent article assignment.
    const result = await client.from("categories").delete().eq("id", id).select("id").maybeSingle();
    if (result.error?.code === "23503") return { error: "This category is used by articles and cannot be deleted." };
    if (result.error) return failure;
    if (!result.data) return { error: "This category is no longer available." };
    return { success: "Category deleted." };
  } catch { return failure; }
}
