"use client";
import { useState } from "react";
import ArticleArtwork from "./ArticleArtwork";
export default function ArticleCover({ category, url, className = "" }: { category: string; url?: string | null; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) return <ArticleArtwork category={category} className={className} />;
  return <div className={"article-art " + className}>
    {/* Arbitrary administrator-supplied HTTPS URLs load directly; no server-side image fetch. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }} />
  </div>;
}
