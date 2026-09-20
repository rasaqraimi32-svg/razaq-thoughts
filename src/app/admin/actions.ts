"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getAdminAccess } from "@/lib/supabase/admin-access";
import { isSessionCookie } from "@/lib/supabase/session-cookies";

export type LoginState = { error: string };
const unavailable = "Unable to sign in right now. Please try again shortly.";

async function clearSession(client?: SupabaseClient) {
  let revoked = false;
  try {
    if (client) revoked = !(await client.auth.signOut({ scope: "local" })).error;
  } catch { /* The local session must still be cleared. */ }
  finally {
    const store = await cookies();
    store.getAll().filter(cookie => isSessionCookie(cookie.name)).forEach(({ name }) => store.delete(name));
  }
  return revoked;
}

export async function login(_state: LoginState, form: FormData): Promise<LoginState> {
  const emailValue = form.get("email");
  const password = form.get("password");
  const email = typeof emailValue === "string" ? emailValue.trim() : "";
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };
  if (typeof password !== "string" || !password || password.length > 4096) return { error: "Enter your password (up to 4096 characters)." };
  let client: SupabaseClient | undefined;
  try {
    client = await createClient();
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      await clearSession(client);
      return { error: error.status === 429 ? "Too many attempts. Please wait before trying again." : error.status && error.status < 500 ? "Email or password is incorrect, or the account is not ready to sign in." : unavailable };
    }
    const access = await getAdminAccess(client);
    if (access.status !== "admin") {
      await clearSession(client);
      return { error: access.status === "forbidden" ? "You do not have administrator access." : unavailable };
    }
  } catch {
    await clearSession(client);
    return { error: unavailable };
  }
  revalidatePath("/admin", "layout");
  redirect("/admin");
}

export async function logout() {
  let client: SupabaseClient | undefined;
  try { client = await createClient(); } catch { /* Clear local cookies even if configuration is unavailable. */ }
  const revoked = await clearSession(client);
  revalidatePath("/admin", "layout");
  redirect(revoked ? "/admin/login" : "/admin/login?error=logout-local");
}
