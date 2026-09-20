export type PublicComment = {
  id: string;
  articleId: string;
  name: string;
  content: string;
  createdAt: string;
};
export type AdminComment = {
  id: string;
  articleId: string;
  name: string;
  email: string;
  content: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  articleTitle: string;
  articleSlug: string;
};
export type Category = { id: string; name: string; slug: string };
export type ArticleStatus = "draft" | "published" | "archived";
export type ArticleRecord = {
  id: string; title: string; slug: string; excerpt: string; content: string;
  category_id: string | null; author_name: string; reading_time: number | null;
  cover_image_url: string | null; featured: boolean; status: ArticleStatus;
  published_at: string | null; created_at: string; updated_at: string;
  categories?: { name: string; slug: string } | null;
};
export type PublicArticle = {
  id: string; title: string; slug: string; excerpt: string; category: string;
  author: string; publishedAt: string; readingTime: number; featured: boolean;
  coverImageUrl?: string | null;
  content: { type: "paragraph" | "heading" | "quote"; text: string }[];
};
export type MutationState = { error?: string; success?: string; errors?: Record<string, string>; id?: string };
export const articleColumns = "id,title,slug,excerpt,content,category_id,author_name,reading_time,cover_image_url,featured,status,published_at,created_at,updated_at,categories(name,slug)";
export function formatDate(date: string | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(date));
}
export function toPublicArticle(row: ArticleRecord): PublicArticle {
  return { id: row.id, title: row.title, slug: row.slug, excerpt: row.excerpt,
    category: row.categories?.name ?? "Uncategorised", author: row.author_name,
    publishedAt: row.published_at ?? row.created_at,
    readingTime: row.reading_time ?? Math.max(1, Math.ceil(row.content.trim().split(/\s+/).length / 200)),
    featured: row.featured, coverImageUrl: row.cover_image_url,
    // Plain text stays escaped by React; HTML supplied in the editor is never executed.
    content: row.content.split(/\n\s*\n/).filter(Boolean).map(text => ({ type: "paragraph", text })),
  };
}
