import Link from "next/link";
import type { PublicArticle as Article } from "@/lib/journal/types";
import ArticleCover from "./ArticleCover";
import ArticleMeta from "./ArticleMeta";
import Arrow from "./Arrow";

export default function ArticleCard({ article }: { article: Article }) {
  return <article className="article-card">
    <Link href={"/articles/" + article.slug} className="art-link" tabIndex={-1} aria-hidden="true"><ArticleCover category={article.category} url={article.coverImageUrl} /></Link>
    <div className="card-content"><p className="eyebrow category-label">{article.category}</p><h3><Link href={"/articles/" + article.slug}>{article.title}</Link></h3><p className="card-excerpt">{article.excerpt}</p><ArticleMeta article={article} /><Link className="text-link card-read" href={"/articles/" + article.slug}>Read article <span className="sr-only">: {article.title}</span><Arrow /></Link></div>
  </article>;
}
