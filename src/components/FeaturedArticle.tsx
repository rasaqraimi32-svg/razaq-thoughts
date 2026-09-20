import Link from "next/link";
import type { PublicArticle as Article } from "@/lib/journal/types";
import ArticleCover from "./ArticleCover";
import ArticleMeta from "./ArticleMeta";
import Arrow from "./Arrow";

export default function FeaturedArticle({ article }: { article: Article }) {
  return <article className="featured-article"><ArticleCover category={article.category} url={article.coverImageUrl} className="featured-art" /><div className="featured-content"><p className="eyebrow category-label">{article.category} <span className="eyebrow-divider">/</span> Featured perspective</p><h3><Link href={"/articles/" + article.slug}>{article.title}</Link></h3><p className="featured-excerpt">{article.excerpt}</p><ArticleMeta article={article} /><Link className="text-link" href={"/articles/" + article.slug}>Read Article <Arrow /></Link></div></article>;
}
