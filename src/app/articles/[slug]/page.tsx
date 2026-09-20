import { getApprovedComments } from "@/lib/journal/comment-queries";
import CommentForm from "@/components/CommentForm";
import type { Metadata } from "next";
import { publicPageMetadata } from "@/lib/site-metadata";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedArticle, getPublishedArticles } from "@/lib/journal/public-queries";
import { formatDate } from "@/lib/journal/types";
import ArticleCover from "@/components/ArticleCover";
import ArticleCard from "@/components/ArticleCard";
import ShareArticle from "@/components/ShareArticle";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = await getPublishedArticle((await params).slug);
  if (!article) return { title: "Article not found" };
  const metadata = publicPageMetadata(
    `/articles/${article.slug}`, article.title, article.excerpt,
  );
  return {
    ...metadata,
    openGraph: {
      ...metadata.openGraph,
      type: "article",
      publishedTime: article.publishedAt,
      authors: [article.author],
    },
  };
}

export default async function ArticlePage({ params }: Props) {
  const article = await getPublishedArticle((await params).slug);
  if (!article) notFound();
  const [{ articles }, comments] = await Promise.all([
    getPublishedArticles(1, 12),
    // A failed comment read must not hide the published article.
    getApprovedComments(article.id).catch(() => null),
  ]);
  const others = articles.filter(item => item.id !== article.id);
  const related = [...others.filter(item => item.category === article.category), ...others.filter(item => item.category !== article.category)].slice(0, 3);
  return <div className="container article-page"><nav className="breadcrumb" aria-label="Breadcrumb"><ol><li><Link href="/">Home</Link></li><li><span aria-hidden="true">/</span><Link href="/articles">Articles</Link></li><li><span aria-hidden="true">/</span><span aria-current="page">{article.category}</span></li></ol></nav>
    <article><header className="article-heading"><p className="eyebrow category-label">{article.category} <span className="eyebrow-divider">/</span> Thoughts & reflections</p><h1>{article.title}</h1><p className="article-deck">{article.excerpt}</p><div className="byline"><span className="author-monogram" aria-hidden="true">RT</span><div><p>{article.author}</p><p className="byline-details"><time dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time><span aria-hidden="true"> · </span>{article.readingTime} min read</p></div><a href="#discussion" className="discussion-link">Discussion <span aria-hidden="true">↓</span></a></div></header>
    <ArticleCover category={article.category} url={article.coverImageUrl} className="article-cover" /><div className="reading-layout"><aside className="reading-aside"><p className="eyebrow">A moment to reflect</p><p>Read with curiosity.<br />Leave with a question.</p></aside><div><div className="article-prose">{article.content.map((block, index) => block.type === "heading" ? <h2 key={index}>{block.text}</h2> : block.type === "quote" ? <blockquote key={index}><p>{block.text}</p></blockquote> : <p key={index} style={{ whiteSpace: "pre-wrap" }}>{block.text}</p>)}</div><div className="article-end" aria-hidden="true">✳</div><ShareArticle title={article.title} /><section id="discussion" className="discussion" aria-labelledby="discussion-title"><p className="eyebrow category-label">Room for another perspective</p><h2 id="discussion-title">Join the discussion</h2><p>What stayed with you? What would you question? Thoughtful disagreement and shared experiences make a good article the start of a conversation.</p><div className="discussion-comments">
  {comments === null ? (
    <p className="muted-note" role="status">
      Comments are temporarily unavailable. Please try again later.
    </p>
  ) : comments.length > 0 ? (
    <div className="comment-list" aria-label="Approved comments">
      {comments.map((comment) => (
        <article className="comment-item" key={comment.id}>
          <div className="comment-item-header">
            <strong>{comment.name}</strong>
            <time dateTime={comment.createdAt}>
              {formatDate(comment.createdAt)}
            </time>
          </div>
          <p>{comment.content}</p>
        </article>
      ))}
    </div>
  ) : (
    <p className="muted-note">
      No comments yet. Be the first to share your perspective.
    </p>
  )}<CommentForm articleId={article.id} slug={article.slug} />
</div><p className="muted-note">A note on comments: engage with ideas, respect people, and give reasons for your point of view.</p></section></div>

</div></article>
    <section className="related-section" aria-labelledby="related-title"><div className="section-heading"><div><p className="eyebrow category-label">Keep reading</p><h2 id="related-title">Related articles</h2></div><Link className="text-link" href="/articles">All articles <span aria-hidden="true">↗</span></Link></div><div className="article-grid">{related.map(item => <ArticleCard article={item} key={item.id} />)}</div></section>
  </div>;
}
