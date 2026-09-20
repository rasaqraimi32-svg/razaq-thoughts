import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminAccess =
  | { status: "admin"; displayName: string }
  | { status: "guest" | "forbidden" | "unavailable" };

/** Verify identity with Auth, then permissions with the caller's RLS-scoped profile. */
export async function getAdminAccess(client: SupabaseClient): Promise<AdminAccess> {
  try {
    const { data: { user }, error } = await client.auth.getUser();
    if (error) return { status: error.status && error.status >= 500 ? "unavailable" : "guest" };
    if (!user) return { status: "guest" };
    const { data: profile, error: profileError } = await client
      .from("profiles").select("id, display_name, role").eq("id", user.id).maybeSingle();
    if (profileError) return { status: "unavailable" };
    if (!profile || profile.id !== user.id || profile.role !== "admin") return { status: "forbidden" };
    return { status: "admin", displayName: profile.display_name };
  } catch {
    return { status: "unavailable" };
  }
}
