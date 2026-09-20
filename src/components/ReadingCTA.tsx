import Link from "next/link";
import Arrow from "./Arrow";

export default function ReadingCTA() {
  return <section className="reading-cta" aria-labelledby="reading-cta-title"><div><p className="eyebrow">Keep the conversation going</p><h2 id="reading-cta-title">A good read is only<br />the beginning.</h2><p>Find a new perspective. Form your own. Bring a question to the conversation.</p></div><Link className="button button-light" href="/articles">Explore Articles <Arrow /></Link></section>;
}
