"use client";

export default function JournalError({ reset }: { reset: () => void }) {
  return <section role="alert" aria-labelledby="journal-error-title">
    <h1 id="journal-error-title">Unable to load your website dashboard.</h1>
    <p>The data request failed or took too long. Please try again.</p>
    <button className="button" onClick={reset}>Try again</button>
  </section>;
}
