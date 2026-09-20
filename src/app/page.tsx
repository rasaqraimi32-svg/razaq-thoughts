import Link from "next/link";
import { publicPageMetadata } from "@/lib/site-metadata";
import ArticleCard from "@/components/ArticleCard";
import FeaturedArticle from "@/components/FeaturedArticle";
import CategoryList from "@/components/CategoryList";
import ReadingCTA from "@/components/ReadingCTA";
import Arrow from "@/components/Arrow";
import { getPublishedArticles } from "@/lib/journal/public-queries";
import { getCategories } from "@/lib/journal/queries";

export const dynamic = "force-dynamic";
export const metadata = publicPageMetadata("/");

export default async function Home() {
  const [{ articles }, featuredResult, categories] = await Promise.all([getPublishedArticles(1, 7), getPublishedArticles(1, 1, true), getCategories()]);
  const featured = featuredResult.articles[0] ?? articles[0];
  const latest = articles.filter(article => article.id !== featured?.id).slice(0, 6);
  return <div className="container">
    <section className="hero" aria-labelledby="hero-title"><div className="hero-copy"><p className="eyebrow"><span className="small-rule" /> A personal space for thoughts and reflections</p><h1 id="hero-title">Ideas Worth Reading.<br /><em>Perspectives Worth</em><br /><em>Discussing.</em></h1><p className="hero-description">I’m Razaq. This is where I share my articles, thoughts and reflections on the ideas and experiences that stay with me.</p><div className="hero-actions"><Link className="button" href="/articles">Explore Articles <Arrow /></Link><Link className="text-link" href="/about">Learn More <Arrow /></Link></div></div><aside className="hero-aside"><span className="journal-symbol" aria-hidden="true">✳</span><p>For the curious.<br />For the considered.<br /><em>For a different point of view.</em></p><span className="eyebrow">Read. Reflect. Discuss.</span></aside></section>
    <section className="featured-section" aria-labelledby="featured-title"><div className="section-heading"><h2 id="featured-title" className="eyebrow">In focus</h2><span className="section-note">A perspective to spend time with</span></div>{featured ? <FeaturedArticle article={featured} /> : <div className="section-space"><h2>New perspectives are on their way.</h2><p className="muted-note">I’m working on new writing. Visit again soon for articles, thoughts and reflections.</p></div>}</section>
    <section className="section-space" aria-labelledby="latest-title"><div className="section-heading"><div><p className="eyebrow category-label">The reading room</p><h2 id="latest-title">Latest articles</h2></div><Link className="text-link" href="/articles">View all articles <Arrow /></Link></div><p className="collection-note">{latest.length ? "My latest articles, thoughts and reflections." : "More perspectives will appear here as they are published."}</p><div className="article-grid">{latest.map(article => <ArticleCard key={article.id} article={article} />)}</div></section>
    <section className="subjects-section" aria-labelledby="subjects-title"><div><p className="eyebrow category-label">Follow your curiosity</p><h2 id="subjects-title">Many subjects.<br /> Fresh perspectives.</h2></div><div><CategoryList categories={categories.map(category => category.name)} /><p className="muted-note">Category browsing is coming soon. <Link href="/articles">Explore the full collection.</Link></p></div></section>
    <section className="mission-section" aria-labelledby="mission-title"><p className="eyebrow category-label">Why I write</p><div><h2 id="mission-title">Good ideas deserve<br /><em>a public conversation.</em></h2><p>Writing helps me think through the questions that shape everyday life. Razaq Thoughts is where I share that process, reflect on what I’m learning, and invite you to share your own perspective.</p><Link className="text-link" href="/about">About Me <Arrow /></Link></div></section>
    <ReadingCTA />
  </div>;
}
