import Link from "next/link";
import Arrow from "./Arrow";

export default function ReadingCTA() {
  return <section className="publication-invitation" aria-labelledby="reading-cta-title">
    <span className="invitation-mark" aria-hidden="true">RT</span>
    <div><p className="eyebrow">An open invitation</p><h2 id="reading-cta-title">Make room for<br /><em>another perspective.</em></h2><p>A quiet place to read deeply, think freely, and join the conversation.</p></div>
    <Link className="text-link" href="/articles">Find your next read <Arrow /></Link>
  </section>;
}
