import Link from "next/link";
import { getCategories } from "@/lib/journal/queries";

export default async function Footer() {
  // The footer should not hide the whole site when category loading is unavailable.
  const categories = await getCategories().catch(() => []);
  return <footer className="site-footer"><div className="container">
    <div className="footer-grid">
      <div><Link className="footer-brand" href="/">Razaq Thoughts<span>.</span></Link><p className="footer-description">Articles, thoughts and reflections by Razaq.</p><p className="eyebrow">Read. Reflect. Discuss.</p></div>
      <div><h2 className="footer-heading">Explore</h2><ul className="footer-links"><li><Link href="/">Home</Link></li><li><Link href="/articles">Articles</Link></li><li><Link href="/about">About Me</Link></li><li><Link href="/contact">Contact</Link></li></ul></div>
      <div><h2 className="footer-heading">Topics I write about</h2><ul className="footer-categories">{categories.map(category => <li key={category.id}>{category.name}</li>)}</ul></div>
      <div className="footer-note"><h2 className="footer-heading">Stay curious.</h2><p>Good ideas grow when we make room for another point of view.</p><Link className="text-link" href="/articles">Find your next read <span aria-hidden="true">↗</span></Link></div>
    </div>
    <div className="footer-bottom"><p>© {new Date().getFullYear()} Razaq Thoughts. All rights reserved.</p><p>A personal space for thoughts and reflections.</p></div>
  </div></footer>;
}
