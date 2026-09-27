import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { getAdminAccess } from "@/lib/supabase/admin-access";
import { COVER_BUCKET, coverPathPattern } from "./cover-settings";
import type { MutationState } from "./types";

export function coverUrl(path: string) {
  if (!coverPathPattern.test(path)) throw new Error("Invalid cover path");
  return getSupabaseConfig().url.replace(/\/$/, "") + "/storage/v1/object/public/" + COVER_BUCKET + "/" + path;
}
export function managedCoverPath(url: string | null | undefined) {
  if (!url) return null;
  const prefix = getSupabaseConfig().url.replace(/\/$/, "") + "/storage/v1/object/public/" + COVER_BUCKET + "/";
  const path = url.startsWith(prefix) ? url.slice(prefix.length) : "";
  return coverPathPattern.test(path) ? path : null;
}

// Authenticated admin client sees references from drafts as well as published articles.
// The Storage DELETE policy independently refuses deletion of referenced images.
export async function removeUnusedCover(client: SupabaseClient, url: string | null | undefined) {
  const path = managedCoverPath(url);
  if (!path) return true; // Never delete external or legacy objects.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const references = await client.from("articles").select("id", { count: "exact", head: true }).eq("cover_image_url", url);
      if (references.error || references.count === null) continue;
      if (references.count > 0) return true;
      const result = await client.storage.from(COVER_BUCKET).remove([path]);
      if (!result.error && result.data?.some(object => object.name === path)) return true;
      // A successful empty result can mean already deleted OR blocked by RLS.
      const listed = await client.storage.from(COVER_BUCKET).list("uploads", { search: path.slice(8), limit: 2 });
      if (!listed.error && listed.data && !listed.data.some(object => object.name === path.slice(8))) return true;
    } catch { /* Retry transient failures; preserve the object if references cannot be checked. */ }
  }
  return false;
}

export async function cleanupUnusedCovers(client: SupabaseClient): Promise<MutationState> {
  if ((await getAdminAccess(client)).status !== "admin") return { error: "Administrator access is required." };
  try {
    // Collect before deleting so offset pagination cannot skip shifted rows.
    const candidates: string[] = [];
    for (let offset = 0; ; offset += 100) {
      const result = await client.storage.from(COVER_BUCKET).list("uploads", { limit: 100, offset, sortBy: { column: "name", order: "asc" } });
      if (result.error || !result.data) return { error: "Unable to check unused images. Check the Storage setup and try again." };
      for (const object of result.data) {
        const path = "uploads/" + object.name;
        // Protect uploads still in flight, including requests interrupted before save.
        if (coverPathPattern.test(path) && Date.parse(object.created_at ?? "") < Date.now() - 86400000) candidates.push(path);
      }
      if (result.data.length < 100) break;
      if (offset >= 9900) return { error: "Too many images for interactive cleanup. Ask your maintainer to run a paginated cleanup." };
    }
    for (const path of candidates) if (!await removeUnusedCover(client, coverUrl(path))) return { error: "Some unused images could not be removed. Please retry later." };
    return { success: "Cleanup complete. Referenced images and uploads from the last 24 hours were preserved." };
  } catch { return { error: "Cleanup is unavailable. Please retry later." }; }
}
