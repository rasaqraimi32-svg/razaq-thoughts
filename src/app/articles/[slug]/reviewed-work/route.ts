import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { serveReviewedPdf } from "@/lib/journal/reviewed-work-download";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { url, publishableKey } = getSupabaseConfig();
  // Deliberately anonymous, even when the visitor is signed in as administrator.
  const client = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  return serveReviewedPdf(client, (await params).slug, new URL(request.url).searchParams.get("download") === "1");
}
