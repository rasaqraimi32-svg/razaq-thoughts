import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
import { readQuery } from "@/lib/journal/read-query";
import { siteUrl } from "@/lib/site-metadata";

// Reflect publishing and unpublishing on every request.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = ["/", "/articles", "/about", "/contact"].map(
    (pathname) => ({ url: new URL(pathname, siteUrl).href }),
  );
  const client = await createClient();
  const pageSize = 500;
  let offset = 0;

  // Page through the table instead of truncating at Supabase's response limit.
  while (true) {
    const { data, count } = await readQuery(
      (signal) => client.from("articles")
        .select("slug,updated_at", { count: "exact" })
        .eq("status", "published")
        .order("id")
        .range(offset, offset + pageSize - 1)
        .abortSignal(signal),
      "The sitemap is temporarily unavailable.",
    );
    if (!data?.length) break;
    for (const article of data) {
      entries.push({
        url: siteUrl + "/articles/" + encodeURIComponent(article.slug),
        ...(article.updated_at ? { lastModified: article.updated_at } : {}),
      });
    }
    offset += data.length;
    if (count !== null && offset >= count) break;
  }

  return entries;
}
