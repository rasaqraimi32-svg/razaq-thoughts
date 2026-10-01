"use client";
import { useState } from "react";
import { previewExistingSimulationDatesAction, confirmExistingSimulationDatesAction } from "@/app/admin/(protected)/simulation-date-actions";
import type { SimulationDatePreview } from "@/lib/journal/existing-simulation-dates";

export default function ExistingSimulationDates() {
  const [preview, setPreview] = useState<SimulationDatePreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const count = preview?.articles.filter(a => a.status === "eligible").reduce((sum, a) => sum + a.count, 0) ?? 0;

  async function prepare() {
    setBusy(true); setError(""); setMessage(""); setPreview(null);
    try {
      const response = await previewExistingSimulationDatesAction();
      if (response.error) setError(response.error);
      else if (response.result) setPreview(response.result);
    } catch { setError("Preview failed. Check your session and try again."); }
    finally { setBusy(false); }
  }

  async function confirm() {
    if (!preview || !count || !window.confirm(`Apply the exact previewed timestamps to ${count} existing simulated comments?`)) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await confirmExistingSimulationDatesAction(preview.id, true);
      if (response.error) setError(response.error);
      else if (response.result) setMessage(`Updated ${response.result.updated} timestamps. Skipped ${response.result.skippedArticles} incompatible articles. Comment identities and content were preserved.`);
    } catch { setError("Confirmation outcome is unknown. Prepare a fresh preview before retrying."); }
    finally { setPreview(null); setBusy(false); }
  }

  return <section aria-labelledby="existing-simulation-dates-title">
    <h3 id="existing-simulation-dates-title">Randomize Existing Simulation Dates</h3>
    <p>Redistribute existing simulated comments between September 25 and September 30, 2026. Existing comment content and identities will remain unchanged.</p>
    <button disabled={busy} onClick={prepare}>Preview existing simulation dates</button>
    {error && <p role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    {preview && <div>
      <p>All times below are UTC. This preview expires at {preview.expiresAt}. Review every comment before confirming.</p>
      {!preview.articles.length && <p>No existing simulation batches.</p>}
      {preview.articles.map(article => <section key={article.articleId}>
        <h4>{article.title} — {article.count} simulated comments</h4>
        {article.status === "incompatible" ? <p>Incompatible count — skipped. Six dates require 18–24 comments.</p> : <>
          <ul>{article.days.map(day => <li key={day.date}>{day.date} — {day.count} comments</li>)}</ul>
          <ol>{article.comments.map(comment => <li key={comment.id}>
            <p><strong>{comment.name}</strong> — ID: {comment.id}</p>
            <p style={{ whiteSpace: "pre-wrap" }}>{comment.content}</p>
            <p>Current UTC: <time dateTime={comment.currentTimestamp}>{comment.currentTimestamp}</time></p>
            <p>Planned UTC: <time dateTime={comment.plannedTimestamp}>{comment.plannedTimestamp}</time></p>
          </li>)}</ol>
        </>}
      </section>)}
      <button disabled={busy || count === 0} onClick={confirm}>Confirm these exact timestamps ({count} comments)</button>
      <button disabled={busy} onClick={() => setPreview(null)}>Cancel</button>
    </div>}
  </section>;
}
