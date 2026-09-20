"use client";
export default function ErrorPage({ reset }: { reset: () => void }) { return <section className="container section-space"><h1>The website is temporarily unavailable.</h1><p>Please try again in a moment.</p><button className="button" onClick={reset}>Try again</button></section>; }
