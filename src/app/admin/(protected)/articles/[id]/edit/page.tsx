import { getAdminReviewedWork } from "@/lib/journal/reviewed-work-queries";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAdminArticle, getCategories } from "@/lib/journal/queries";
import ArticleForm from "@/components/admin/ArticleForm";
export const metadata: Metadata = { title: "Edit article" };
export default async function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const article = await getAdminArticle(id); if (!article) notFound();
  const categories = await getCategories();
  const reviewed = await getAdminReviewedWork(id);
  return <section><p className="eyebrow category-label">The writing desk</p><h1>Edit article</h1><ArticleForm article={article} categories={categories} reviewedWork={reviewed.work} reviewedAvailable={reviewed.available} /></section>;
}
