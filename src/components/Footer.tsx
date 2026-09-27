import Link from "next/link";
import { getCategories } from "@/lib/journal/queries";

export default async function Footer() {
  const categories = await getCategories().catch(() => []);
  return <footer className="site-footer publication-footer"><div className="container">
    <div className="footer-masthead"><Link className="footer-brand" href="/">Razaq Thoughts<span>.</span></Link><p>A personal collection.<br /><em>An ongoing conversation.</em></p></div>
    <div className="footer-grid">
      <div><p className="footer-description">Articles, essays and reflections by Razaq. For the curious, the considered, and those willing to look again.</p><p className="eyebrow">Read. Reflect. Discuss.</p></div>
      <div><h2 className="footer-heading">The reading room</h2><ul className="footer-links"><li><Link href="/">Home</Link></li><li><Link href="/articles">The collection</Link></li><li><Link href="/about">About Razaq</Link></li><li><Link href="/contact">Contact</Link></li></ul></div>
      <div><h2 className="footer-heading">Across disciplines</h2><ul className="footer-categories">{categories.map(category => <li key={category.id}>{category.name}</li>)}</ul></div>
      <div className="footer-note"><h2 className="footer-heading">A thought to take with you</h2><p>Good ideas grow when we make room for another point of view.</p><Link className="text-link" href="/articles">Keep reading <span aria-hidden="true">↗</span></Link></div>
    </div>
    <div className="footer-bottom"><p>© {new Date().getFullYear()} Razaq Thoughts. All rights reserved.</p><p>Written with curiosity. Read at your own pace.</p></div>
  </div></footer>;
}
