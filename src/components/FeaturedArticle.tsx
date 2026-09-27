import Link from "next/link";
import type { PublicArticle as Article } from "@/lib/journal/types";
import ArticleCover from "./ArticleCover";
import ArticleMeta from "./ArticleMeta";
import Arrow from "./Arrow";

export default function FeaturedArticle({ article }: { article: Article }) {
  return (
    <article className="publication-feature">
      <Link href={"/articles/" + article.slug} className="feature-cover-stage" aria-label={"Read " + article.title}>
        <span className="feature-edition" aria-hidden="true">The selected reading</span>
        <ArticleCover category={article.category} title={article.title} author={article.author} url={article.coverImageUrl} />
      </Link>
      <div className="feature-copy">
        <p className="eyebrow category-label">In focus <span className="eyebrow-divider">/</span> {article.category}</p>
        <h3><Link href={"/articles/" + article.slug}>{article.title}</Link></h3>
        <p className="feature-deck">{article.excerpt}</p>
        <ArticleMeta article={article} />
        <Link className="button" href={"/articles/" + article.slug}>Read the article <Arrow /></Link>
      </div>
    </article>
  );
}
