import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(file, mocks = {}) {
  const source = readFileSync(new URL("../" + file, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const loadedModule = { exports: {} };
  vm.runInNewContext(compiled, { module: loadedModule, exports: loadedModule.exports, URL, require: name => name in mocks ? mocks[name] : require(name) });
  return loadedModule.exports;
}
const { getAdminAccess } = load("src/lib/supabase/admin-access.ts");
function client({ user = { id: "test-user" }, authError = null, profile = { id: "test-user", role: "admin", display_name: "Editor" }, profileError = null } = {}) {
  return {
    auth: { getUser: async () => ({ data: { user }, error: authError }) },
    from: table => { assert.equal(table, "profiles"); return {
      select: columns => { assert.equal(columns, "id, display_name, role"); return {
        eq: (column, id) => { assert.equal(column, "id"); assert.equal(id, "test-user"); return { maybeSingle: async () => ({ data: profile, error: profileError }) }; },
      }; },
    }; },
  };
}
for (const [label, input, status] of [
  ["allows verified administrator", {}, "admin"],
  ["rejects missing session", { user: null }, "guest"],
  ["rejects invalid Auth session", { authError: { status: 401 } }, "guest"],
  ["rejects missing profile", { profile: null }, "forbidden"],
  ["rejects non-admin role", { profile: { id: "test-user", role: "member" } }, "forbidden"],
  ["rejects profile for another identity", { profile: { id: "someone-else", role: "admin" } }, "forbidden"],
  ["fails closed on profile errors", { profileError: { message: "private detail" } }, "unavailable"],
  ["fails closed on Auth outage", { authError: { status: 503 } }, "unavailable"],
]) test(label, async () => assert.equal((await getAdminAccess(client(input))).status, status));

test("sanitizes thrown network failures", async () => {
  const access = await getAdminAccess({ auth: { getUser: async () => { throw Error("sensitive detail"); } } });
  assert.equal(access.status, "unavailable");
  assert.equal(JSON.stringify(access).includes("sensitive"), false);
});

const config = { getSupabaseConfig: () => ({ url: "https://testproject.supabase.co", publishableKey: "test-only" }) };
const { isSessionCookie } = load("src/lib/supabase/session-cookies.ts", { "./config": config });
test("clears only this project's session cookies", () => {
  for (const name of ["sb-testproject-auth-token", "sb-testproject-auth-token.0", "sb-testproject-auth-token.12", "sb-testproject-auth-token-code-verifier"]) assert.equal(isSessionCookie(name), true);
  for (const name of ["unrelated", "sb-another-auth-token", "sb-testproject-auth-token.other"]) assert.equal(isSessionCookie(name), false);
});

const { NextRequest, NextResponse } = require("next/server");
for (const [status, path, destination] of [
  ["guest", "/admin", "/admin/login"],
  ["guest", "/admin/future-page", "/admin/login"],
  ["guest", "/admin/login", null],
  ["admin", "/admin", null],
  ["admin", "/admin/login", "/admin"],
  ["forbidden", "/admin", "/admin/login?error=access-denied"],
  ["unavailable", "/admin", "/admin/login?error=unavailable"],
]) test("proxy: " + status + " at " + path, async () => {
  let signedOut = false;
  const { proxy } = load("src/proxy.ts", {
    "next/server": { NextResponse },
    "@/lib/supabase/config": config,
    "@/lib/supabase/session-cookies": { isSessionCookie },
    "@/lib/supabase/admin-access": { getAdminAccess: async () => ({ status }) },
    "@supabase/ssr": { createServerClient: (_url, _key, options) => {
      options.cookies.setAll([{ name: "sb-testproject-auth-token", value: "refreshed-test-value", options: { path: "/" } }], { "Cache-Control": "private, no-store" });
      return { auth: { signOut: async () => { signedOut = true; return { error: null }; } } };
    } },
  });
  const response = await proxy(new NextRequest("http://localhost:3000" + path));
  assert.equal(response.headers.get("location"), destination ? "http://localhost:3000" + destination : null);
  assert.match(response.headers.get("cache-control"), /private.*no-store/);
  assert.equal(response.cookies.get("sb-testproject-auth-token").value, status === "forbidden" ? "" : "refreshed-test-value");
  assert.equal(signedOut, status === "forbidden");
});

function actions(status, signInError = null, signOutThrows = false) {
  const deleted = [];
  let signedOut = false;
  const auth = {
    signInWithPassword: async () => ({ error: signInError }),
    signOut: async () => { signedOut = true; if (signOutThrows) throw Error("offline"); return { error: null }; },
  };
  const handlers = load("src/app/admin/actions.ts", {
    "next/headers": { cookies: async () => ({ getAll: () => [{ name: "sb-testproject-auth-token.0" }, { name: "other-cookie" }], delete: name => deleted.push(name) }) },
    "next/navigation": { redirect: url => { throw Error("REDIRECT:" + url); } },
    "next/cache": { revalidatePath: () => {} },
    "@/lib/supabase/server": { createClient: async () => ({ auth }) },
    "@/lib/supabase/admin-access": { getAdminAccess: async () => ({ status }) },
    "@/lib/supabase/session-cookies": { isSessionCookie },
  });
  return { ...handlers, deleted, signedOut: () => signedOut };
}
const credentials = () => { const form = new FormData(); form.set("email", "editor@example.invalid"); form.set("password", "test-only-password"); return form; };
test("login requires both credentials", async () => {
  const action = actions("admin");
  assert.match((await action.login({}, new FormData())).error, /email/);
  const form = credentials(); form.delete("password");
  assert.match((await action.login({}, form)).error, /password/);
});
test("login rejects invalid credentials without leaking Auth details", async () => {
  const action = actions("guest", { status: 400, message: "sensitive detail" });
  const result = await action.login({}, credentials());
  assert.match(result.error, /incorrect/);
  assert.equal(result.error.includes("sensitive"), false);
});
test("successful admin login redirects", async () => {
  await assert.rejects(actions("admin").login({}, credentials()), /REDIRECT:\/admin$/);
});
test("non-admin login signs out and clears cookies", async () => {
  const action = actions("forbidden");
  assert.equal((await action.login({}, credentials())).error, "You do not have administrator access.");
  assert.equal(action.signedOut(), true);
  assert.deepEqual(action.deleted, ["sb-testproject-auth-token.0"]);
});
test("logout revokes session and redirects to login", async () => {
  const action = actions("admin");
  await assert.rejects(action.logout(), /REDIRECT:\/admin\/login$/);
  assert.equal(action.signedOut(), true);
  assert.deepEqual(action.deleted, ["sb-testproject-auth-token.0"]);
});
test("logout clears local session even when Auth is offline", async () => {
  const action = actions("admin", null, true);
  await assert.rejects(action.logout(), /logout-local/);
  assert.deepEqual(action.deleted, ["sb-testproject-auth-token.0"]);
});
