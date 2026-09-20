"use client";

import { useState } from "react";

export default function ShareArticle({ title }: { title: string }) {
  const [message, setMessage] = useState("");
  const [fallback, setFallback] = useState("");
  async function copyLink() {
    try { await navigator.clipboard.writeText(window.location.href); setMessage("Article link copied."); setFallback(""); }
    catch { setFallback(window.location.href); setMessage("Copy the link from the field below."); }
  }
  return <div className="share-section"><span className="eyebrow">Worth sharing?</span><div className="share-actions"><button className="button button-outline button-small" type="button" onClick={copyLink}>Copy link <span aria-hidden="true">↗</span></button><button className="text-link" type="button" onClick={() => { window.location.href = "mailto:?subject=" + encodeURIComponent(title) + "&body=" + encodeURIComponent(window.location.href); }}>Share by email</button></div><p className="share-status" role="status">{message}</p>{fallback && <label className="share-fallback">Article link<input readOnly value={fallback} onFocus={event => event.target.select()} /></label>}</div>;
}
