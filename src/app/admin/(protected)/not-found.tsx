import Link from "next/link";
export default function NotFound() { return <section className="section-space"><h1>Article not found.</h1><p>This article may have been deleted.</p><Link className="text-link" href="/admin/articles">Return to articles →</Link></section>; }
