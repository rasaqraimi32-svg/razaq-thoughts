type Props = { category: string; title?: string; author?: string; className?: string };

/** Neutral placeholder for older articles and unavailable image URLs. */
export default function ArticleArtwork({ className = "" }: Props) {
  return <div className={"publication-cover cover-placeholder " + className} aria-hidden="true">
    <svg width="44" height="52" viewBox="0 0 44 52" fill="none">
      <path d="M8 3h20l9 9v37H8V3Z M28 3v10h9 M15 23h15 M15 30h15 M15 37h10" stroke="currentColor" strokeWidth="1.5" />
    </svg>
    <span>Cover image unavailable</span>
  </div>;
}
