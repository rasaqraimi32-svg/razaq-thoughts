import type { Metadata } from "next";
import { publicPageMetadata } from "@/lib/site-metadata";
import Link from "next/link";
import ArticleCard from "@/components/ArticleCard";
import CategoryList from "@/components/CategoryList";
import { getPublishedArticles } from "@/lib/journal/public-queries";
import { getCategories, pageNumber } from "@/lib/journal/queries";
export const dynamic = "force-dynamic";
export async function generateMetadata({ searchParams }: { searchParams: Promise<{ page?: string }> }): Promise<Metadata> {
  const page = pageNumber((await searchParams).page);
  return publicPageMetadata(
    page > 1 ? `/articles?page=${page}` : "/articles",
    page > 1 ? `Articles — Page ${page}` : "Articles",
    "Read articles, thoughts and reflections by Razaq on everyday life and the ideas that shape it.",
  );
}
export default async function ArticlesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = pageNumber((await searchParams).page);
  const [{ articles, count }, categories] = await Promise.all([getPublishedArticles(page), getCategories()]);
  return <div className="container listing-page"><header className="page-intro"><p className="eyebrow category-label">The reading room</p><h1>A little more perspective.</h1><p>My articles, thoughts and reflections. Explore the questions I’m thinking about and join the conversation.</p></header><section aria-labelledby="collection-title"><div className="listing-toolbar"><h2 id="collection-title">All articles</h2><div className="search-preview"><label className="sr-only" htmlFor="article-search">Search articles (coming soon)</label><span aria-hidden="true">⌕</span><input id="article-search" type="search" placeholder="Search articles" disabled aria-describedby="browse-preview" /></div></div><CategoryList includeAll categories={categories.map(category => category.name)} /><p className="muted-note" id="browse-preview">Search and category filters are coming soon.</p><div className="listing-count"><span>{String(count).padStart(2, "0")} articles</span><span>Newest first</span></div>{articles.length ? <div className="article-grid">{articles.map(article => <ArticleCard key={article.id} article={article} />)}</div> : <div className="section-space"><h2>{count ? "No articles on this page." : "New perspectives are on their way."}</h2><p className="muted-note">{count ? "Return to the first page to keep reading." : "I’m working on new writing. Visit again soon for articles, thoughts and reflections."}</p>{count > 0 && <Link className="text-link" href="/articles">First page →</Link>}</div>}<nav className="pagination" aria-label="Article pages">{page > 1 ? <Link href={"/articles?page=" + (page - 1)}>← Previous</Link> : <button disabled>← Previous</button>}<span aria-current="page" className="page-number">{page}</span>{page * 12 < count ? <Link href={"/articles?page=" + (page + 1)}>Next →</Link> : <button disabled>Next →</button>}</nav></section></div>;
}
