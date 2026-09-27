"use client";
import { useState } from "react";
import ArticleArtwork from "./ArticleArtwork";

type Props = { category: string; title?: string; author?: string; url?: string | null; className?: string; priority?: boolean };

export default function ArticleCover({ category, title, author, url, className = "", priority = false }: Props) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (!url || failedUrl === url) return <ArticleArtwork category={category} title={title} author={author} className={className} />;
  return <div className={"publication-cover image-cover " + className}>
    {/* Keep existing arbitrary HTTPS covers browser-loaded; display the original image without a generated cover or crop. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={url} alt={title ? "Cover for " + title : ""} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} referrerPolicy="no-referrer" onError={() => setFailedUrl(url)} />
  </div>;
}
