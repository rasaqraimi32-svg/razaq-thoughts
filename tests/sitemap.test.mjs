import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(path, mocks = {}) {
  const source = readFileSync(new URL("../" + path, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const result = { exports: {} };
  vm.runInNewContext(compiled, { module: result, exports: result.exports, URL, require: name => {
    if (name in mocks) return mocks[name];
    throw Error("Unexpected import: " + name);
  } });
  return result.exports;
}
const metadata = load("src/lib/site-metadata.ts");
function sitemap(rows, fail = false) {
  const client = { from(table) {
    assert.equal(table, "articles");
    let status, start, end;
    const query = {
      select() { return query; },
      eq(key, value) { assert.equal(key, "status"); status = value; return query; },
      order() { return query; },
      range(a, b) { start = a; end = b; return query; },
      abortSignal() {
        if (fail) throw Error("Unavailable");
        const published = rows.filter(row => row.status === status);
        // Simulate a server cap below the requested page size.
        return Promise.resolve({ data: published.slice(start, Math.min(end + 1, start + 100)), count: published.length, error: null });
      },
    };
    return query;
  } };
  return load("src/app/sitemap.ts", {
    "@/lib/site-metadata": metadata,
    "@/lib/supabase/server": { createClient: async () => client },
    "@/lib/journal/read-query": { readQuery: fn => fn() },
  }).default;
}
test("sitemap includes all published articles across response caps and excludes private rows", async () => {
  const rows = Array.from({ length: 1100 }, (_, i) => ({ slug: "article-" + i, status: "published", updated_at: "2026-09-26T00:00:00Z" }));
  rows.push({ slug: "draft", status: "draft" }, { slug: "archived", status: "archived" });
  const entries = await sitemap(rows)();
  assert.equal(entries.length, 1104);
  assert.equal(new Set(entries.map(entry => entry.url)).size, 1104);
  assert.equal(entries.at(-1).url, "https://razaqthoughts.site/articles/article-1099");
  assert.equal(entries.at(-1).lastModified, rows[0].updated_at);
  assert.ok(entries.every(entry => !/admin|draft|archived/.test(entry.url)));
});
test("empty sitemap retains the four public pages on the production domain", async () => {
  assert.deepEqual(Array.from(await sitemap([])(), entry => entry.url), ["https://razaqthoughts.site/", "https://razaqthoughts.site/articles", "https://razaqthoughts.site/about", "https://razaqthoughts.site/contact"]);
});
test("database failure does not silently serve an incomplete sitemap", async () => {
  await assert.rejects(sitemap([], true)(), /Unavailable/);
});
test("robots allows public crawling and disallows the entire admin prefix", () => {
  const result = load("src/app/robots.ts", { "@/lib/site-metadata": metadata }).default();
  assert.equal(result.rules.userAgent, "*");
  assert.equal(result.rules.allow, "/");
  for (const route of ["/admin", "/admin/login", "/admin/articles", "/admin/comments"]) assert.ok(route.startsWith(result.rules.disallow));
  assert.equal(result.sitemap, "https://razaqthoughts.site/sitemap.xml");
});
