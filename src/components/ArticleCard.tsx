import Link from "next/link";
import type { PublicArticle as Article } from "@/lib/journal/types";
import ArticleCover from "./ArticleCover";
import ArticleMeta from "./ArticleMeta";
import Arrow from "./Arrow";

export default function ArticleCard({ article }: { article: Article }) {
  return (
    <article className="publication-card">
      <Link href={"/articles/" + article.slug} className="publication-card-link">
        <div className="publication-plinth" aria-hidden="true">
          <ArticleCover category={article.category} title={article.title} author={article.author} url={article.coverImageUrl} />
          <span className="cover-open">Open publication <Arrow /></span>
        </div>
        <div className="publication-card-heading">
          <p className="eyebrow category-label">{article.category}</p>
          <h3>{article.title}</h3>
        </div>
      </Link>
      <p className="publication-excerpt">{article.excerpt}</p>
      <ArticleMeta article={article} />
    </article>
  );
}
