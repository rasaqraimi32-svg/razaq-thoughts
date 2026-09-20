"use client";
export default function ArticlesError({ reset }: { reset: () => void }) { return <section className="container section-space"><h1>We couldn’t load the articles.</h1><p>Please try again in a moment.</p><button className="button" onClick={reset}>Try again</button></section>; }
