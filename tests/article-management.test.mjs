import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
function load(file, mocks = {}) {
  const path = resolve(root, file);
  const source = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const result = { exports: {} };
  const localRequire = name => {
    if (name in mocks) return mocks[name];
    if (name === "server-only") return {};
    if (name.startsWith("@/")) return load("src/" + name.slice(2) + ".ts", mocks);
    if (name.startsWith(".")) return load(resolve(dirname(path), name + ".ts"), mocks);
    return require(name);
  };
  vm.runInNewContext(source, { module: result, exports: result.exports, require: localRequire, URL, AbortController, setTimeout, clearTimeout });
  return result.exports;
}
const categoryId = "10000000-0000-4000-8000-000000000001";
const articleId = "20000000-0000-4000-8000-000000000001";
const originalDate = "2026-09-20T10:00:00.000Z";
const mutations = load("src/lib/journal/mutations.ts");
const validation = load("src/lib/journal/validation.ts");
function form(overrides = {}) {
  const values = { title: "A thoughtful article", slug: "a-thoughtful-article", excerpt: "A useful introduction.", content: "A complete article body.", category_id: categoryId, author_name: "The Journal", status: "draft", reading_time: "3", slug_mode: "manual", updated_at: originalDate, ...overrides };
  const result = new FormData(); Object.entries(values).forEach(([key, value]) => result.set(key, value)); return result;
}
function database({ admin = true, authenticated = true } = {}) {
  const db = { categories: [{ id: categoryId, name: "Society", slug: "society" }], articles: [], profiles: admin ? [{ id: "auth-user", role: "admin", display_name: "Editor" }] : [] };
  const calls = [];
  let serial = 1;
  let failNext = null;
  const client = {
    auth: { getUser: async () => ({ data: { user: authenticated ? { id: "auth-user" } : null }, error: null }) },
    from(table) {
      let operation = "read", payload, filters = [], single = false, head = false, start = 0, end = Infinity;
      const query = {
        select(_columns, options) { head = options?.head ?? false; return query; },
        eq(key, value) { filters.push([key, value]); return query; },
        order() { return query; },
        abortSignal() { return query; },
        range(first, last) { start = first; end = last; return query; },
        insert(values) { operation = "insert"; payload = { ...values }; return query; },
        update(values) { operation = "update"; payload = { ...values }; return query; },
        delete() { operation = "delete"; return query; },
        maybeSingle() { single = true; return query; },
        single() { single = true; return query; },
        then(accept, reject) {
          return Promise.resolve().then(() => {
            calls.push({ table, operation, filters, payload });
            if (failNext && table === failNext.table && operation === failNext.operation) { const error = failNext.error; failNext = null; return { data: null, error, count: null }; }
            let rows = db[table].filter(row => filters.every(([key, value]) => row[key] === value));
            if (operation === "insert" || operation === "update") {
              const duplicate = (operation === "insert" || rows.length > 0) && db[table].some(row => (operation === "insert" || !rows.includes(row)) && (row.slug === payload.slug || (table === "categories" && row.name === payload.name)));
              if (duplicate) return { data: null, error: { code: "23505" } };
              if (operation === "insert") {
                const row = { id: "30000000-0000-4000-8000-" + String(serial++).padStart(12, "0"), created_at: originalDate, updated_at: originalDate, published_at: null, ...payload };
                if (row.status === "published") row.published_at = originalDate;
                db[table].push(row); rows = [row];
              } else rows.forEach(row => { Object.assign(row, payload, { updated_at: "2026-09-20T11:00:00.000Z" }); if (row.status === "published" && !row.published_at) row.published_at = originalDate; });
            }
            if (operation === "delete") {
              if (table === "categories" && db.articles.some(article => rows.some(row => row.id === article.category_id))) return { data: null, error: { code: "23503" } };
              db[table] = db[table].filter(row => !rows.includes(row));
            }
            const count = rows.length;
            const data = head ? null : single ? rows[0] ?? null : rows.slice(start, end + 1);
            return { data, error: null, count };
          }).then(accept, reject);
        },
      };
      return query;
    },
  };
  return { client, db, calls, fail: value => { failNext = value; } };
}
function existing(overrides = {}) { return { id: articleId, ...Object.fromEntries(form()), reading_time: 3, featured: false, published_at: null, created_at: originalDate, updated_at: originalDate, ...overrides }; }

test("administrator creates a draft with no publication date", async () => {
  const { client, db } = database(); const result = await mutations.saveArticle(client, null, form());
  assert.ok(result.id); assert.equal(db.articles.length, 1); assert.equal(db.articles[0].published_at, null);
});
test("administrator publishes an article", async () => {
  const { client, db } = database(); assert.ok((await mutations.saveArticle(client, null, form({ status: "published" }))).success);
  assert.equal(db.articles[0].status, "published"); assert.ok(db.articles[0].published_at);
});
test("editing updates the existing row without duplicating it", async () => {
  const { client, db } = database(); db.articles.push(existing());
  assert.ok((await mutations.saveArticle(client, articleId, form({ title: "Edited" }))).success);
  assert.equal(db.articles.length, 1); assert.equal(db.articles[0].title, "Edited"); assert.notEqual(db.articles[0].updated_at, originalDate);
});
test("unpublishing preserves original publication date and slug", async () => {
  const { client, db, calls } = database(); db.articles.push(existing({ status: "published", published_at: originalDate }));
  assert.ok((await mutations.saveArticle(client, articleId, form({ title: "New title" }))).success);
  assert.equal(db.articles[0].published_at, originalDate); assert.equal(db.articles[0].slug, "a-thoughtful-article");
  assert.equal("published_at" in calls.find(call => call.operation === "update").payload, false);
});
test("stale editor cannot overwrite newer changes", async () => {
  const { client, db } = database(); db.articles.push(existing({ updated_at: "2026-09-20T12:00:00Z" }));
  assert.match((await mutations.saveArticle(client, articleId, form({ title: "Overwrite" }))).error, /changed/);
  assert.notEqual(db.articles[0].title, "Overwrite");
});
test("explicit duplicate slugs are rejected", async () => {
  const { client, db } = database(); db.articles.push(existing());
  assert.match((await mutations.saveArticle(client, null, form())).errors.slug, /already in use/);
  assert.equal(db.articles.length, 1);
});
test("generated duplicate slugs receive a unique suffix", async () => {
  const { client, db } = database(); db.articles.push(existing());
  assert.ok((await mutations.saveArticle(client, null, form({ slug_mode: "auto" }))).success);
  assert.equal(db.articles[1].slug, "a-thoughtful-article-2");
});
for (const [field, value] of [["title", " "], ["slug", "Invalid/Slug"], ["excerpt", ""], ["content", ""], ["category_id", "invalid"], ["status", "hidden"], ["reading_time", "1.5"], ["reading_time", "0"], ["cover_image_url", "javascript:alert(1)"], ["author_name", ""]]) {
  test("rejects invalid " + field + ": " + value, async () => {
    const { client, calls } = database(); const result = await mutations.saveArticle(client, null, form({ [field]: value }));
    assert.ok(result.errors[field]); assert.equal(calls.some(call => call.operation !== "read"), false);
  });
}
test("deleted category cannot be assigned", async () => {
  const { client, db } = database(); db.categories = [];
  assert.match((await mutations.saveArticle(client, null, form())).errors.category_id, /no longer exists/);
});
test("delete requires confirmation and removes only the selected article", async () => {
  const { client, db } = database(); db.articles.push(existing());
  assert.match((await mutations.deleteArticle(client, articleId, form())).error, /Confirm/);
  assert.equal(db.articles.length, 1);
  assert.ok((await mutations.deleteArticle(client, articleId, form({ confirm: "yes" }))).success);
  assert.equal(db.articles.length, 0);
});
for (const identity of [{ admin: false }, { admin: false, authenticated: false }]) test("all mutations reject unauthorized identity " + JSON.stringify(identity), async () => {
  const { client, calls } = database(identity);
  const results = await Promise.all([mutations.saveArticle(client, null, form()), mutations.saveArticle(client, articleId, form()), mutations.deleteArticle(client, articleId, form({ confirm: "yes" })), mutations.saveCategory(client, null, form()), mutations.saveCategory(client, categoryId, form()), mutations.deleteCategory(client, categoryId, form({ confirm: "yes" }))]);
  results.forEach(result => assert.match(result.error, /Administrator access/));
  assert.equal(calls.some(call => call.operation !== "read"), false);
});
test("category create, update, duplicate rejection and unused deletion", async () => {
  const { client, db } = database(); const categoryForm = form({ name: "New subject", slug: "new-subject" });
  const created = await mutations.saveCategory(client, null, categoryForm); assert.ok(created.id);
  assert.ok((await mutations.saveCategory(client, created.id, form({ name: "Renamed", slug: "renamed" }))).success);
  assert.match((await mutations.saveCategory(client, null, form({ name: "Society", slug: "society" }))).error, /already exists/);
  assert.ok((await mutations.deleteCategory(client, created.id, form({ confirm: "yes" }))).success);
  assert.equal(db.categories.length, 1);
});
test("category used by a draft cannot be deleted", async () => {
  const { client, db } = database(); db.articles.push(existing());
  assert.match((await mutations.deleteCategory(client, categoryId, form({ confirm: "yes" }))).error, /used by articles/);
  assert.equal(db.categories.length, 1);
});
test("foreign-key race returns a friendly category deletion error", async () => {
  const fixture = database(); fixture.fail({ table: "categories", operation: "delete", error: { code: "23503", message: "private database details" } });
  assert.match((await mutations.deleteCategory(fixture.client, categoryId, form({ confirm: "yes" }))).error, /used by articles/);
});
test("database details never escape mutation errors", async () => {
  const fixture = database(); fixture.fail({ table: "articles", operation: "insert", error: { code: "500", message: "private detail" } });
  const result = await mutations.saveArticle(fixture.client, null, form()); assert.ok(result.error); assert.equal(result.error.includes("private"), false);
});
test("public queries restrict draft and archived rows even with an admin client", async () => {
  const { client, db, calls } = database();
  db.articles.push(existing({ slug: "draft" }), existing({ slug: "archived", status: "archived" }), existing({ slug: "published", status: "published", published_at: originalDate }));
  const publicQueries = load("src/lib/journal/public-queries.ts", { react: { cache: fn => fn }, "@/lib/supabase/server": { createClient: async () => client } });
  assert.equal((await publicQueries.getPublishedArticles()).articles.length, 1);
  assert.equal(await publicQueries.getPublishedArticle("draft"), null);
  assert.equal(await publicQueries.getPublishedArticle("archived"), null);
  assert.equal((await publicQueries.getPublishedArticle("published")).slug, "published");
  assert.ok(calls.every(call => call.filters.some(([field, value]) => field === "status" && value === "published")));
});
test("slug normalization produces safe stable ASCII URLs", () => {
  assert.equal(validation.slugify(" Café & Ideas! "), "cafe-ideas");
  assert.equal(validation.slugify("!!!"), "article");
});
