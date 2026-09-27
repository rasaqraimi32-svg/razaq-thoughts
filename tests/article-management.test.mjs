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
  const source = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const result = { exports: {} };
  const localRequire = name => {
    if (name in mocks) return mocks[name];
    if (name === "server-only") return {};
    if (name.startsWith("@/")) return load("src/" + name.slice(2) + ".ts", mocks);
    if (name.startsWith(".")) return load(resolve(dirname(path), name + ".ts"), mocks);
    return require(name);
  };
  vm.runInNewContext(source, { module: result, exports: result.exports, require: localRequire, Buffer, File, FormData, URL, AbortController, setTimeout, clearTimeout });
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

// Cover lifecycle tests use real image decoding and the existing mutation/database fixture.
const sharp = require("sharp");
const coverMocks = { "@/lib/supabase/config": { getSupabaseConfig: () => ({ url: "https://example.supabase.co" }) } };
const covers = load("src/lib/journal/cover-mutations.ts", coverMocks);
const storageHelpers = load("src/lib/journal/cover-storage.ts", coverMocks);
const coverValidation = load("src/lib/journal/cover-validation.ts");
const oldPath = "uploads/40000000-0000-4000-8000-000000000001.png";
const oldUrl = storageHelpers.coverUrl(oldPath);
async function imageFile(format = "png", overrides = {}) {
  const bytes = await sharp({ create: { width: 32, height: 48, channels: 3, background: "#ddd6bd" } }).toFormat(format).toBuffer();
  return new File([bytes], overrides.name ?? "front-page." + format, { type: overrides.type ?? "image/" + format });
}
function storageFixture(options = {}) {
  const fixture = database(options);
  const objects = new Map();
  const storageCalls = [];
  const flags = { failUpload: false, failRemove: false };
  fixture.client.storage = { from(bucket) {
    assert.equal(bucket, "article-covers");
    return {
      async upload(path, bytes, options) {
        storageCalls.push({ operation: "upload", path, options });
        if (flags.failUpload) return { error: { message: "private detail" } };
        assert.equal(options.upsert, false);
        objects.set(path, { bytes, created_at: new Date().toISOString() }); return { data: { path }, error: null };
      },
      async remove(paths) {
        storageCalls.push({ operation: "remove", paths });
        if (flags.failRemove) return { data: null, error: { message: "private detail" } };
        const data = [];
        for (const path of paths) if (objects.has(path) && !fixture.db.articles.some(a => a.cover_image_url === storageHelpers.coverUrl(path))) { objects.delete(path); data.push({ name: path }); }
        return { data, error: null };
      },
      async list(prefix, options) {
        const all = [...objects.entries()].map(([path, value]) => ({ name: path.slice(prefix.length + 1), created_at: value.created_at })).sort((a, b) => a.name.localeCompare(b.name)).filter(o => !options.search || o.name.includes(options.search));
        return { data: all.slice(options.offset ?? 0, (options.offset ?? 0) + options.limit), error: null };
      },
    };
  } };
  return { ...fixture, objects, storageCalls, flags };
}
async function uploadForm(overrides = {}) {
  const data = form({ cover_intent: "replace", ...overrides }); data.set("cover_file", await imageFile()); return data;
}
for (const format of ["jpeg", "png", "webp"]) test("cover accepts decoded " + format + " and retains dimensions", async () => {
  const result = await coverValidation.validateCover(await imageFile(format));
  const metadata = await sharp(result.bytes).metadata();
  assert.equal(metadata.width, 32); assert.equal(metadata.height, 48); assert.equal(result.contentType, "image/" + format);
});
test("cover accepts JPEG extension and absent browser MIME", async () => {
  assert.equal((await coverValidation.validateCover(await imageFile("jpeg", { name: "cover.JPG", type: "" }))).extension, "jpg");
});
for (const [name, type, bytes] of [["review.pdf", "application/pdf", "%PDF-1.7"], ["cover.svg", "image/svg+xml", "<svg/>"], ["fake.jpg", "image/jpeg", "not an image"], ["cover.gif", "image/gif", "GIF89a"]]) test("rejects unsupported or forged image " + name, async () => {
  await assert.rejects(coverValidation.validateCover(new File([bytes], name, { type })));
});
test("rejects extension/MIME mismatch, truncation, empty and oversized files", async () => {
  await assert.rejects(coverValidation.validateCover(await imageFile("png", { name: "false.jpg", type: "image/jpeg" })));
  await assert.rejects(coverValidation.validateCover(await imageFile("png", { type: "image/webp" })));
  const valid = await imageFile(); const truncated = (await valid.arrayBuffer()).slice(0, 40);
  await assert.rejects(coverValidation.validateCover(new File([truncated], "broken.png", { type: "image/png" })));
  await assert.rejects(coverValidation.validateCover(new File([], "empty.png")), /3 MB/);
  await assert.rejects(coverValidation.validateCover(new File([new Uint8Array(3 * 1024 * 1024 + 1)], "large.png")), /3 MB/);
});
test("rejects decompression dimensions exceeding 24 megapixels", async () => {
  const large = await sharp({ create: { width: 5000, height: 5000, channels: 3, background: "white" } }).png().toBuffer();
  await assert.rejects(coverValidation.validateCover(new File([large], "large.png", { type: "image/png" })), /24 megapixels/);
});
test("creates article with a unique stable public cover URL", async () => {
  const f = storageFixture(); const result = await covers.saveArticleWithCover(f.client, null, await uploadForm());
  assert.ok(result.success); assert.equal(f.objects.size, 1);
  const url = f.db.articles[0].cover_image_url;
  assert.ok(storageHelpers.managedCoverPath(url)); assert.equal(url.includes("front-page"), false); assert.equal(url.includes("token="), false);
});
test("saving without an image uses null and ignores injected URL", async () => {
  const f = storageFixture(); assert.ok((await covers.saveArticleWithCover(f.client, null, form({ cover_image_url: oldUrl }))).success);
  assert.equal(f.db.articles[0].cover_image_url, null); assert.equal(f.storageCalls.length, 0);
});
test("replacement saves new reference and deletes old managed file", async () => {
  const f = storageFixture(); f.db.articles.push(existing({ cover_image_url: oldUrl })); f.objects.set(oldPath, {});
  assert.ok((await covers.saveArticleWithCover(f.client, articleId, await uploadForm())).success);
  assert.notEqual(f.db.articles[0].cover_image_url, oldUrl); assert.equal(f.objects.has(oldPath), false); assert.equal(f.objects.size, 1);
});
test("remove image clears record then removes bytes", async () => {
  const f = storageFixture(); f.db.articles.push(existing({ cover_image_url: oldUrl })); f.objects.set(oldPath, {});
  assert.ok((await covers.saveArticleWithCover(f.client, articleId, form({ cover_intent: "remove" }))).success);
  assert.equal(f.db.articles[0].cover_image_url, null); assert.equal(f.objects.size, 0);
});
test("failed article save cleans new upload and preserves original", async () => {
  const f = storageFixture(); f.db.articles.push(existing({ cover_image_url: oldUrl })); f.objects.set(oldPath, {});
  f.fail({ table: "articles", operation: "update", error: { code: "500" } });
  const result = await covers.saveArticleWithCover(f.client, articleId, await uploadForm());
  assert.ok(result.error); assert.equal(f.db.articles[0].cover_image_url, oldUrl); assert.equal(f.objects.size, 1); assert.ok(f.objects.has(oldPath));
});
test("duplicate slug cleans newly uploaded image", async () => {
  const f = storageFixture(); f.db.articles.push(existing());
  assert.ok((await covers.saveArticleWithCover(f.client, null, await uploadForm())).errors.slug); assert.equal(f.objects.size, 0);
});
test("stale editor and invalid article never upload", async () => {
  const f = storageFixture(); f.db.articles.push(existing({ updated_at: "2026-09-21T00:00:00Z" }));
  assert.ok((await covers.saveArticleWithCover(f.client, articleId, await uploadForm())).error);
  assert.ok((await covers.saveArticleWithCover(f.client, null, await uploadForm({ title: "" }))).errors.title);
  assert.equal(f.storageCalls.length, 0);
});
test("upload error prevents article mutation and hides internals", async () => {
  const f = storageFixture(); f.flags.failUpload = true;
  const result = await covers.saveArticleWithCover(f.client, null, await uploadForm());
  assert.match(result.error, /could not be uploaded/); assert.equal(result.error.includes("private detail"), false); assert.equal(f.db.articles.length, 0);
});
test("shared cover is retained even when referenced by a draft", async () => {
  const f = storageFixture(); f.db.articles.push(existing({ cover_image_url: oldUrl }), existing({ id: categoryId, slug: "other", cover_image_url: oldUrl })); f.objects.set(oldPath, {});
  assert.ok((await covers.saveArticleWithCover(f.client, articleId, await uploadForm())).success); assert.ok(f.objects.has(oldPath));
});
test("external URLs are preserved when keeping and never deleted when replacing", async () => {
  const f = storageFixture(); f.db.articles.push(existing({ cover_image_url: "https://external.example/cover.jpg" }));
  assert.ok((await covers.saveArticleWithCover(f.client, articleId, form())).success); assert.equal(f.db.articles[0].cover_image_url, "https://external.example/cover.jpg");
  assert.equal(storageHelpers.managedCoverPath("https://evil.example/storage/v1/object/public/article-covers/" + oldPath), null);
  assert.equal(storageHelpers.managedCoverPath(oldUrl + "?token=123"), null);
  assert.equal(storageHelpers.managedCoverPath(oldUrl.replace("uploads/", "uploads/../")), null);
});
test("delete article removes its unreferenced image only after confirmation", async () => {
  const f = storageFixture(); f.db.articles.push(existing({ cover_image_url: oldUrl })); f.objects.set(oldPath, {});
  assert.ok((await covers.deleteArticleWithCover(f.client, articleId, form())).error); assert.ok(f.objects.has(oldPath));
  assert.ok((await covers.deleteArticleWithCover(f.client, articleId, form({ confirm: "yes" }))).success); assert.equal(f.objects.size, 0);
});
for (const identity of [{ admin: false }, { admin: false, authenticated: false }]) test("cover operations deny unauthorized caller " + JSON.stringify(identity), async () => {
  const f = storageFixture(identity);
  for (const result of [await covers.saveArticleWithCover(f.client, null, await uploadForm()), await covers.deleteArticleWithCover(f.client, articleId, form({ confirm: "yes" })), await storageHelpers.cleanupUnusedCovers(f.client)]) assert.match(result.error, /Administrator access/);
  assert.equal(f.storageCalls.length, 0); assert.equal(f.db.articles.length, 0);
});
test("failed cleanup reports saved result and can be retried without losing referenced files", async () => {
  const f = storageFixture(); f.db.articles.push(existing({ cover_image_url: oldUrl })); f.objects.set(oldPath, { created_at: "2020-01-01T00:00:00Z" }); f.flags.failRemove = true;
  const result = await covers.saveArticleWithCover(f.client, articleId, await uploadForm());
  assert.ok(result.success); assert.match(result.error, /Clean up unused images/); assert.equal(f.objects.size, 2);
  f.flags.failRemove = false;
  assert.ok((await storageHelpers.cleanupUnusedCovers(f.client)).success); assert.equal(f.objects.size, 1);
});
test("cleanup protects recent uploads and all article references", async () => {
  const f = storageFixture(); f.objects.set(oldPath, { created_at: "2020-01-01T00:00:00Z" }); f.db.articles.push(existing({ cover_image_url: oldUrl }));
  const recent = oldPath.replace(/1.png$/, "2.png"); f.objects.set(recent, { created_at: new Date().toISOString() });
  assert.ok((await storageHelpers.cleanupUnusedCovers(f.client)).success); assert.equal(f.objects.size, 2);
});

for (const operation of ["save", "delete"]) test(operation + " cleanup warning survives redirect and revalidation", async () => {
  const paths = [];
  const actions = load("src/app/admin/(protected)/article-actions.ts", {
    "@/lib/supabase/server": { createClient: async () => ({}) },
    "@/lib/journal/reviewed-work-mutations": { deleteArticleWithReviewedPdf: async () => ({ success: "Article deleted.", error: "Cleanup pending." }) },
    "@/lib/journal/cover-mutations": {
      saveArticleWithCover: async () => ({ success: "Article saved.", error: "Cleanup pending." }),
      deleteArticleWithCover: async () => ({ success: "Article deleted.", error: "Cleanup pending." }),
    },
    "next/cache": { revalidatePath: path => paths.push(path) },
    "next/navigation": { redirect: url => { throw new Error("redirect:" + url); } },
  });
  await assert.rejects(actions[operation + "ArticleAction"](articleId, {}, form()), error => error.message === "redirect:/admin/articles?notice=" + (operation === "save" ? "cover-cleanup" : "cover-delete-cleanup"));
  assert.deepEqual(paths, ["/"]);
});


const richContent = load("src/lib/journal/rich-content.ts");
test("rich article creation and editing preserve structured formatting in the existing content column", async () => {
  const fixture = database();
  const doc = { type: "doc", content: [{ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Review" }] }, { type: "paragraph", content: [{ type: "text", text: "A considered view.", marks: [{ type: "italic" }] }] }] };
  const content = richContent.serializeRichContent(doc);
  const created = await mutations.saveArticle(fixture.client, null, form({ content }));
  assert.ok(created.id); assert.equal(fixture.db.articles[0].content, content);
  doc.content[1].content[0].text = "An edited view.";
  const edited = richContent.serializeRichContent(doc);
  assert.ok((await mutations.saveArticle(fixture.client, created.id, form({ content: edited }))).success);
  assert.equal(fixture.db.articles[0].content, edited); assert.equal(fixture.db.articles.length, 1);
});
test("server rejects malformed or empty rich content before creating or overwriting an article", async () => {
  for (const value of ["{broken", JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }), JSON.stringify({ type: "doc", content: [{ type: "iframe" }] })]) {
    for (const id of [null, articleId]) {
      const fixture = database(); fixture.db.articles.push(existing());
      const result = await mutations.saveArticle(fixture.client, id, form({ content: richContent.RICH_CONTENT_PREFIX + value }));
      assert.ok(result.errors.content);
      assert.equal(fixture.calls.some(call => call.operation !== "read"), false);
      assert.equal(fixture.db.articles[0].content, existing().content);
    }
  }
});
test("server strips dangerous links and arbitrary attributes from direct rich submissions", () => {
  const content = richContent.RICH_CONTENT_PREFIX + JSON.stringify({ type: "doc", content: [{ type: "paragraph", attrs: { style: "color:red" }, content: [{ type: "text", text: "Safe words", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }, { type: "bold", attrs: { onclick: "evil()" } }] }] }] });
  const result = validation.validateArticle(form({ content }), false);
  assert.equal(Object.keys(result.errors).length, 0);
  assert.doesNotMatch(result.values.content, /javascript|onclick|style/);
  assert.match(result.values.content, /bold/);
});
test("editing only metadata preserves existing plain text content", async () => {
  const fixture = database(); const content = "First paragraph.\n\nSecond line.\nContinuation <b>literal</b>.";
  fixture.db.articles.push(existing({ content }));
  assert.ok((await mutations.saveArticle(fixture.client, articleId, form({ title: "New title", content }))).success);
  assert.equal(fixture.db.articles[0].content, content);
});
