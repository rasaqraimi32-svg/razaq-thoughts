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
  return <div className="container publication-page">
    <section className="publication-hero" aria-labelledby="hero-title">
      <div className="publication-hero-copy">
        <p className="eyebrow"><span className="small-rule" /> An independent collection of ideas</p>
        <h1 id="hero-title">A life examined.<br /><em>A world reconsidered.</em></h1>
        <p className="hero-introduction">Welcome to Razaq Thoughts. Articles, essays and reflections on the questions that stay with us.</p>
        <div className="hero-actions"><Link className="button" href="/articles">Explore the collection <Arrow /></Link><Link className="text-link" href="/about">Meet Razaq <Arrow /></Link></div>
        <p className="hero-colophon">Read thoughtfully. Question openly. Return often.</p>
      </div>
      <div className="hero-object" aria-hidden="true">
        <span className="hero-orbit" />
        <div className="hero-volume"><div className="volume-top">The personal collection <span>RT</span></div><div className="volume-title">Razaq<br /><em>Thoughts.</em></div><div className="volume-drawing"><span /><span /><span /></div><div className="volume-bottom">On ideas, life<br />& the art of reflection.<span>Essays & reflections</span></div></div>
        <span className="hero-object-caption">A space for the considered life.</span>
      </div>
    </section>
    <div className="publication-divider"><span>Independent thought</span><span>Considered writing</span><span>Open conversation</span></div>
    <section className="publication-section" aria-labelledby="featured-title">
      <div className="publication-section-heading"><div><p className="eyebrow category-label">01 / The editor’s selection</p><h2 id="featured-title">A closer reading.</h2></div><p>One idea. A little more attention.</p></div>
      {featured ? <FeaturedArticle article={featured} /> : <div className="publication-empty"><h3>New perspectives are on their way.</h3><p>I’m working on new writing. Visit again soon for articles, thoughts and reflections.</p></div>}
    </section>
    <section className="publication-section" aria-labelledby="latest-title">
      <div className="publication-section-heading"><div><p className="eyebrow category-label">02 / From the reading room</p><h2 id="latest-title">The recent collection.</h2></div><Link className="text-link" href="/articles">View all articles <Arrow /></Link></div>
      {latest.length ? <div className="publication-grid">{latest.map(article => <ArticleCard key={article.id} article={article} />)}</div> : <p className="muted-note">More perspectives will appear here as they are published.</p>}
    </section>
    <section className="publication-topics" aria-labelledby="subjects-title"><div><p className="eyebrow category-label">03 / Across disciplines</p><h2 id="subjects-title">Follow a thread<br /><em>of curiosity.</em></h2></div><div><p className="topics-intro">Different subjects. Connected questions. A collection shaped by the ideas worth returning to.</p><CategoryList categories={categories.map(category => category.name)} /><Link className="text-link" href="/articles">Browse the full collection <Arrow /></Link></div></section>
    <section className="publication-mission" aria-labelledby="mission-title"><p className="eyebrow category-label">A note from Razaq</p><div><h2 id="mission-title">Writing is a way of paying<br /><em>closer attention.</em></h2><p>I write to explore ideas, make sense of experiences, and ask better questions. This collection is an invitation to think alongside me — and to bring your own perspective.</p><Link className="text-link" href="/about">The story behind Razaq Thoughts <Arrow /></Link></div></section>
    <ReadingCTA />
  </div>;
}
