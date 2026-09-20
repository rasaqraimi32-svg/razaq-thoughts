import { getSupabaseConfig } from "./config";

/** Match only this project's SSR session cookies, including chunked values. */
export function isSessionCookie(name: string): boolean {
  const { url } = getSupabaseConfig();
  const key = `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
  return name === key || name === key + "-code-verifier" ||
    (name.startsWith(key + ".") && /^\d+$/.test(name.slice(key.length + 1)));
}
