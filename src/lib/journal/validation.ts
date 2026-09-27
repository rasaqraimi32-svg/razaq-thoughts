import { validateStoredContent } from "./rich-content";
export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export function slugify(title: string) {
  return title.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 160).replace(/-$/g, "") || "article";
}
export function text(form: FormData, key: string) { const value = form.get(key); return typeof value === "string" ? value.trim() : ""; }
export function validateArticle(form: FormData, editing: boolean) {
  const errors: Record<string, string> = {};
  const autoSlug = !editing && text(form, "slug_mode") === "auto";
  const title = text(form, "title");
  const slug = autoSlug ? slugify(title) : text(form, "slug");
  const excerpt = text(form, "excerpt");
  let content = text(form, "content");
  try { content = validateStoredContent(content); } catch (error) { errors.content = error instanceof Error ? error.message : "Invalid article content."; }
  const author_name = text(form, "author_name");
  const category_id = text(form, "category_id");
  const status = text(form, "status");
  const reading = text(form, "reading_time");
  const reading_time = reading ? Number(reading) : null;
  const cover_image_url = text(form, "cover_image_url") || null;
  for (const [key, value, max, label] of [["title", title, 250, "Title"], ["excerpt", excerpt, 1000, "Excerpt"], ["author_name", author_name, 150, "Author name"]] as const) {
    if (!value || value.length > max) errors[key] = label + " is required and must be at most " + max + " characters.";
  }
  if (!slugPattern.test(slug) || slug.length > 180) errors.slug = "Use lowercase letters, numbers and single hyphens, up to 180 characters.";
  if (!uuidPattern.test(category_id)) errors.category_id = "Choose a category.";
  if (!(editing ? ["draft", "published", "archived"] : ["draft", "published"]).includes(status)) errors.status = "Choose a valid article status.";
  if (reading && (!/^\d+$/.test(reading) || !Number.isInteger(reading_time) || reading_time! < 1 || reading_time! > 10000)) errors.reading_time = "Reading time must be a whole number between 1 and 10000 minutes, or blank for automatic calculation.";
  if (cover_image_url) {
    try { const url = new URL(cover_image_url); if (url.protocol !== "https:" || url.username || url.password || cover_image_url.length > 2048) throw new Error(); }
    catch { errors.cover_image_url = "Enter a valid HTTPS image URL without embedded credentials, or leave it blank."; }
  }
  return { errors, autoSlug, values: { title, slug, excerpt, content, author_name, category_id, status, reading_time, cover_image_url, featured: form.get("featured") === "on" } };
}
export function validateCategory(form: FormData) {
  const name = text(form, "name"); const slug = text(form, "slug");
  const errors: Record<string, string> = {};
  if (!name || name.length > 100) errors.name = "Category name is required and must be at most 100 characters.";
  if (!slugPattern.test(slug) || slug.length > 180) errors.slug = "Use lowercase letters, numbers and single hyphens, up to 180 characters.";
  return { errors, values: { name, slug } };
}
