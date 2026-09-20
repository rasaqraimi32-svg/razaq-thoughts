import Link from "next/link";
import Arrow from "@/components/Arrow";

export default function NotFound() {
  return <div className="container not-found"><p className="eyebrow category-label">404 / A page out of place</p><h1>This page isn’t<br /><em>on this website.</em></h1><p>The link may be incomplete, or the article may not be available. There are other perspectives waiting to be read.</p><Link className="button" href="/articles">Explore Articles <Arrow /></Link></div>;
}
