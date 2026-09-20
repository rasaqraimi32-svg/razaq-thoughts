import { formatDate, type PublicArticle as Article } from "@/lib/journal/types";

export default function ArticleMeta({ article }: { article: Article }) {
  return <div className="article-meta"><span>{article.author}</span><div><time dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time><span aria-hidden="true"> · </span><span>{article.readingTime} min read</span></div></div>;
}
