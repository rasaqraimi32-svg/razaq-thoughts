import type { ReviewedWork as Work } from "@/lib/journal/reviewed-work";
export default function ReviewedWork({ work, slug }: { work: Work | null; slug: string }) {
  if (!work) return null;
  const href = "/articles/" + slug + "/reviewed-work";
  return <section className="reviewed-work" aria-labelledby="reviewed-work-title"><p className="eyebrow category-label">Work Under Review</p><h2 id="reviewed-work-title">{work.title}</h2><dl><div><dt>Original author</dt><dd>{work.author_name}</dd></div><div><dt>PDF</dt><dd>{work.pdf_original_filename}</dd></div></dl><p className="muted-note">The original work discussed in this article.</p><div className="reviewed-work-actions"><a className="button" href={href} target="_blank" rel="noopener noreferrer">View PDF <span className="sr-only">(opens in a new tab)</span></a><a className="text-link" href={href + "?download=1"}>Download PDF</a></div></section>;
}
