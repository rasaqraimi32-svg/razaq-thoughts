import type { Metadata } from "next";

export const siteName = "Razaq Thoughts";
export const siteUrl = "https://razaqthoughts.site";
export const defaultTitle = "Razaq Thoughts — Articles, Thoughts & Reflections";
export const defaultDescription = "Articles, thoughts and reflections by Razaq. A personal space to read, reflect and join the conversation.";

// Keep canonicals on public pages, rather than inheriting the homepage URL in admin or missing pages.
export function publicPageMetadata(
  pathname: string,
  title?: string,
  description = defaultDescription,
): Metadata {
  const shareTitle = title ? `${title} | ${siteName}` : defaultTitle;
  return {
    ...(title ? { title } : {}),
    description,
    alternates: { canonical: pathname },
    openGraph: {
      type: "website",
      siteName,
      title: shareTitle,
      description,
      url: pathname,
    },
    twitter: { card: "summary", title: shareTitle, description },
  };
}
