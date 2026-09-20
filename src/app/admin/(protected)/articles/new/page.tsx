import type { Metadata } from "next";
import { requireAdmin } from "@/lib/supabase/admin";
import { getCategories } from "@/lib/journal/queries";
import ArticleForm from "@/components/admin/ArticleForm";
export const metadata: Metadata = { title: "New article" };
export default async function NewArticlePage() {
  await requireAdmin(); const categories = await getCategories();
  return <section><p className="eyebrow category-label">The writing desk</p><h1>New article</h1><ArticleForm categories={categories} /></section>;
}
