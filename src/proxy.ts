import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { getAdminAccess } from "@/lib/supabase/admin-access";
import { isSessionCookie } from "@/lib/supabase/session-cookies";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const finish = (destination?: string) => {
    if (destination) {
      const redirected = NextResponse.redirect(new URL(destination, request.url), 303);
      response.cookies.getAll().forEach(cookie => redirected.cookies.set(cookie));
      response = redirected;
    }
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
    return response;
  };
  const login = request.nextUrl.pathname === "/admin/login";
  try {
    const { url, publishableKey } = getSupabaseConfig();
    const client = createServerClient(url, publishableKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookies, headers) {
          cookies.forEach(({ name, value }) => request.cookies.set(name, value));
          const previous = response.cookies.getAll();
          response = NextResponse.next({ request });
          previous.forEach(cookie => response.cookies.set(cookie));
          cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
        },
      },
    });
    const access = await getAdminAccess(client);
    if (access.status === "forbidden") {
      try { await client.auth.signOut({ scope: "local" }); } catch { /* Clear local cookies below even if Auth is unavailable. */ }
      request.cookies.getAll().filter(cookie => isSessionCookie(cookie.name)).forEach(({ name }) => {
        request.cookies.delete(name);
        response.cookies.set(name, "", { path: "/", maxAge: 0 });
      });
      return finish("/admin/login?error=access-denied");
    }
    if (access.status === "admin") return finish(login && request.method === "GET" ? "/admin" : undefined);
    if (!login) return finish(access.status === "unavailable" ? "/admin/login?error=unavailable" : "/admin/login");
    return finish();
  } catch {
    return finish(login ? undefined : "/admin/login?error=unavailable");
  }
}

export const config = { matcher: ["/admin/:path*"] };
