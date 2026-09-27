import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
const require = createRequire(import.meta.url);
const root = dirname(dirname(fileURLToPath(import.meta.url)));
function load(file, mocks = {}) {
  const path = resolve(root, file);
  const output = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const mod = { exports: {} };
  const defaults = { "@/lib/supabase/server": {}, "@/lib/supabase/admin": { requireAdmin: async () => {} } };
  vm.runInNewContext(output, { module: mod, exports: mod.exports, Buffer, File, FormData, Blob, Response, URL, TextDecoder, Uint8Array, AbortController, setTimeout, clearTimeout, require: name => {
    if (name in mocks) return mocks[name];
    if (name in defaults) return defaults[name];
    if (name === "server-only") return {};
    if (name.startsWith("@/")) return load("src/" + name.slice(2) + ".ts", mocks);
    if (name.startsWith(".")) return load(resolve(dirname(path), name + ".ts"), mocks);
    return require(name);
  } });
  return mod.exports;
}
const articleId = "11111111-1111-4111-8111-111111111111";
const workId = "22222222-2222-4222-8222-222222222222";
const oldPath = articleId + "/33333333-3333-4333-8333-333333333333.pdf";
const version = "2026-09-27T00:00:00.000Z";
const pdfBytes = "%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n";
function file(bytes = pdfBytes, name = "original.pdf", type = "application/pdf") { return new File([bytes], name, { type }); }
function form(overrides = {}, upload = file()) {
  const f = new FormData();
  for (const [key, value] of Object.entries({ reviewed_title: "The Original Work", reviewed_author: "Original Author", reviewed_intent: "replace", reviewed_version: "none", ...overrides })) f.set(key, value);
  if (upload) f.set("reviewed_pdf", upload);
  return f;
}
function fixture({ admin = true, authenticated = true, status = "published", existing = false } = {}) {
  const db = { profiles: admin ? [{ id: "admin", role: "admin", display_name: "Admin" }] : [], articles: [{ id: articleId, slug: "test-article", status }], article_reviewed_works: [] };
  const objects = new Map(); const calls = []; let serial = 0;
  const failures = { upload: false, remove: false, write: false, refs: false, download: false, missing: false };
  const client = { auth: { getUser: async () => ({ data: { user: authenticated ? { id: "admin" } : null }, error: null }) }, from(table) {
    let op = "select", filters = [], payload, single = false, head = false, limit = Infinity;
    const q = {
      select(_columns, options) { head = options?.head ?? false; return q; },
      eq(key, value) { filters.push([key, value]); return q; },
      limit(value) { limit = value; return q; }, abortSignal() { return q; },
      maybeSingle() { single = true; return q; },
      insert(value) { op = "insert"; payload = value; return q; },
      update(value) { op = "update"; payload = value; return q; }, delete() { op = "delete"; return q; },
      then(resolve, reject) { return Promise.resolve().then(() => {
        calls.push({ table, op, filters, payload });
        if (failures.missing && table === "article_reviewed_works") return { data: null, error: { code: "42P01" } };
        if (failures.refs && head) return { data: null, count: null, error: { message: "private" } };
        if (op !== "select" && failures.write) return { data: null, error: { code: "500", message: "private" } };
        let rows = db[table].filter(r => filters.every(([k, v]) => r[k] === v));
        if (op === "insert") {
          if (db[table].some(r => r.article_id === payload.article_id)) return { data: null, error: { code: "23505" } };
          const row = { id: workId, created_at: version, updated_at: version, ...payload }; db[table].push(row); rows = [row];
        }
        if (op === "update") rows.forEach(r => Object.assign(r, payload, { updated_at: "2026-09-28T00:00:0" + (++serial) + ".000Z" }));
        if (op === "delete") db[table] = db[table].filter(r => !rows.includes(r));
        rows = rows.slice(0, limit).map(r => ({ ...r }));
        return { data: head ? null : single ? rows[0] ?? null : rows, count: rows.length, error: null };
      }).then(resolve, reject); },
    }; return q;
  }, storage: { from(bucket) {
    assert.equal(bucket, "article-reviewed-pdfs");
    return {
      async upload(path, bytes, options) { calls.push({ op: "upload", path, options }); if (failures.upload) return { error: { message: "private" } }; objects.set(path, { bytes, created: Date.now() }); return { data: { path }, error: null }; },
      async remove(paths) { calls.push({ op: "remove", paths }); if (failures.remove) return { data: null, error: {} }; const data = []; for (const path of paths) if (objects.has(path) && !db.article_reviewed_works.some(w => w.pdf_storage_path === path)) { objects.delete(path); data.push({ name: path }); } return { data, error: null }; },
      async list(folder, options) { return { data: [...objects.keys()].filter(p => p.startsWith(folder + "/") && p.endsWith(options.search)).map(p => ({ name: p.split("/")[1] })), error: null }; },
      async download(path) { calls.push({ op: "download", path }); const exists = objects.get(path); return failures.download || !exists ? { data: null, error: {} } : { data: new Blob([exists.bytes], { type: "application/pdf" }), error: null }; },
    };
  } }, async rpc(name) { assert.equal(name, "get_unused_reviewed_pdf_paths"); return { error: null, data: [...objects.entries()].filter(([p, obj]) => obj.created < Date.now() - 86400000 && !db.article_reviewed_works.some(w => w.pdf_storage_path === p)).map(([path]) => ({ path })) }; } };
  if (existing) {
    db.article_reviewed_works.push({ id: workId, article_id: articleId, title: "Original", author_name: "Writer", pdf_storage_path: oldPath, pdf_original_filename: "old.pdf", created_at: version, updated_at: version });
    objects.set(oldPath, { bytes: pdfBytes, created: 0 });
  }
  return { client, db, objects, calls, failures };
}
const validation = load("src/lib/journal/reviewed-work.ts");
const mutation = load("src/lib/journal/reviewed-work-mutations.ts");
const cleanup = load("src/lib/journal/reviewed-work-storage.ts");
const queries = load("src/lib/journal/reviewed-work-queries.ts");
const download = load("src/lib/journal/reviewed-work-download.ts");
const submit = load("src/lib/journal/reviewed-work-submit.ts");

test("PDF validation preserves original bytes and accepts absent MIME", async () => {
  const result = await validation.validatePdf(file()); assert.equal(Buffer.from(result.bytes).toString(), pdfBytes); assert.equal(result.filename, "original.pdf");
  await validation.validatePdf(file(pdfBytes, "original.PDF", ""));
});
for (const [name, type, bytes] of [["image.png", "image/png", pdfBytes], ["document.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", pdfBytes], ["run.exe", "application/octet-stream", pdfBytes], ["fake.pdf", "application/pdf", "MZ executable"], ["fake.pdf", "image/png", pdfBytes], ["cut.pdf", "application/pdf", "%PDF-1.7\ntruncated"]]) test("rejects non-PDF or invalid input " + name + " " + type, async () => {
  await assert.rejects(validation.validatePdf(file(bytes, name, type)));
});
test("rejects empty and oversized PDFs", async () => {
  await assert.rejects(validation.validatePdf(file("")), /3 MB/);
  await assert.rejects(validation.validatePdf(file(new Uint8Array(3 * 1024 * 1024 + 1))), /3 MB/);
});
test("PDF bibliographic title and author are required only for an attached work", () => {
  assert.equal(Object.keys(validation.reviewedFields(new FormData()).errors).length, 0);
  assert.ok(validation.reviewedFields(form({ reviewed_title: "", reviewed_author: "" })).errors.reviewed_title);
  assert.ok(validation.reviewedFields(form({ reviewed_intent: "keep" })).errors.reviewed_pdf);
});
test("creates a reviewed work with article-scoped UUID storage path", async () => {
  const f = fixture(); const result = await mutation.saveReviewedWork(f.client, articleId, form());
  assert.ok(result.success); assert.equal(f.db.article_reviewed_works.length, 1);
  const row = f.db.article_reviewed_works[0]; assert.ok(validation.pdfPathPattern.test(row.pdf_storage_path)); assert.ok(row.pdf_storage_path.startsWith(articleId + "/"));
  assert.equal(row.pdf_original_filename, "original.pdf"); assert.equal(row.title, "The Original Work"); assert.equal(f.objects.size, 1);
  assert.equal(f.calls.find(c => c.op === "upload").options.upsert, false);
});
test("replaces PDF only after row save and cleans old object", async () => {
  const f = fixture({ existing: true }); assert.ok((await mutation.saveReviewedWork(f.client, articleId, form({ reviewed_version: version }))).success);
  assert.equal(f.objects.has(oldPath), false); assert.equal(f.objects.size, 1);
  assert.ok(f.calls.findIndex(c => c.op === "update") < f.calls.findIndex(c => c.op === "remove"));
});
test("edits title/author without uploading or deleting PDF", async () => {
  const f = fixture({ existing: true }); assert.ok((await mutation.saveReviewedWork(f.client, articleId, form({ reviewed_version: version, reviewed_intent: "keep" }, null))).success);
  assert.equal(f.db.article_reviewed_works[0].pdf_storage_path, oldPath); assert.equal(f.calls.some(c => ["upload", "remove"].includes(c.op)), false);
});
test("remove deletes bibliographic row before unreferenced PDF", async () => {
  const f = fixture({ existing: true }); assert.ok((await mutation.saveReviewedWork(f.client, articleId, form({ reviewed_version: version, reviewed_intent: "remove" }, null))).success);
  assert.equal(f.db.article_reviewed_works.length, 0); assert.equal(f.objects.size, 0);
});
test("failed replacement save cleans upload and retains old PDF", async () => {
  const f = fixture({ existing: true }); f.failures.write = true;
  const result = await mutation.saveReviewedWork(f.client, articleId, form({ reviewed_version: version }));
  assert.ok(result.error); assert.equal(f.objects.size, 1); assert.ok(f.objects.has(oldPath)); assert.equal(f.db.article_reviewed_works[0].pdf_storage_path, oldPath);
});
test("failed upload never updates reviewed work or removes its PDF", async () => {
  const f = fixture({ existing: true }); f.failures.upload = true;
  assert.ok((await mutation.saveReviewedWork(f.client, articleId, form({ reviewed_version: version }))).error);
  assert.ok(f.objects.has(oldPath)); assert.equal(f.calls.some(c => c.op === "update"), false);
});
test("stale or duplicate editor cannot overwrite a reviewed work", async () => {
  const f = fixture({ existing: true }); assert.match((await mutation.saveReviewedWork(f.client, articleId, form())).error, /changed/); assert.equal(f.calls.some(c => c.op === "upload"), false);
});
test("article must exist before any PDF upload", async () => {
  const f = fixture(); f.db.articles = []; assert.match((await mutation.saveReviewedWork(f.client, articleId, form())).error, /unavailable/); assert.equal(f.objects.size, 0);
});
for (const identity of [{ admin: false }, { admin: false, authenticated: false }]) test("PDF mutations, preparation and cleanup reject unauthorized caller " + JSON.stringify(identity), async () => {
  const f = fixture(identity);
  for (const result of [await mutation.saveReviewedWork(f.client, articleId, form()), await mutation.prepareArticleWithReviewedWork(f.client, articleId, form()), await mutation.deleteArticleWithReviewedPdf(f.client, articleId, form()), await cleanup.cleanupReviewedPdfs(f.client)]) assert.match(result.error, /Administrator access/);
  assert.equal(f.calls.some(c => ["upload", "remove", "insert", "update", "delete"].includes(c.op)), false);
});
test("failed cleanup is visible and recoverable after grace period", async () => {
  const f = fixture({ existing: true }); f.failures.remove = true;
  const result = await mutation.saveReviewedWork(f.client, articleId, form({ reviewed_version: version })); assert.ok(result.success); assert.match(result.error, /PDF maintenance/); assert.equal(f.objects.size, 2);
  f.failures.remove = false; assert.ok((await cleanup.cleanupReviewedPdfs(f.client)).success); assert.equal(f.objects.size, 1); assert.equal(f.objects.has(oldPath), false);
});
test("cleanup never deletes referenced PDFs and fails closed when reference lookup fails", async () => {
  const f = fixture({ existing: true }); assert.ok(await cleanup.removeUnusedPdf(f.client, oldPath)); assert.ok(f.objects.has(oldPath));
  f.db.article_reviewed_works = []; f.failures.refs = true; assert.equal(await cleanup.removeUnusedPdf(f.client, oldPath), false); assert.ok(f.objects.has(oldPath));
  assert.equal(await cleanup.removeUnusedPdf(f.client, "../outside.pdf"), false);
});
for (const status of ["published", "draft", "archived"]) test("public reviewed-work retrieval and download respect status " + status, async () => {
  const f = fixture({ existing: true, status }); const work = await queries.findPublishedReviewedWork(f.client, articleId);
  assert.equal(Boolean(work), status === "published"); const response = await download.serveReviewedPdf(f.client, "test-article", false);
  assert.equal(response.status, status === "published" ? 200 : 404);
  if (status !== "published") assert.equal(f.calls.some(c => c.op === "download"), false);
});
test("article without a PDF returns no work and download 404", async () => {
  const f = fixture(); assert.equal(await queries.findPublishedReviewedWork(f.client, articleId), null); assert.equal((await download.serveReviewedPdf(f.client, "test-article", false)).status, 404);
});
test("view is inline; download is attachment with safe Unicode filename and original bytes", async () => {
  const f = fixture({ existing: true }); f.db.article_reviewed_works[0].pdf_original_filename = 'Étude "one"\r\nX-Evil: yes.pdf';
  const view = await download.serveReviewedPdf(f.client, "test-article", false); assert.match(view.headers.get("Content-Disposition"), /^inline;/); assert.equal(await view.text(), pdfBytes);
  const response = await download.serveReviewedPdf(f.client, "test-article", true);
  assert.match(response.headers.get("Content-Disposition"), /^attachment;/); assert.match(response.headers.get("Content-Disposition"), /filename\*=UTF-8''%C3%89tude/);
  assert.equal(response.headers.has("X-Evil"), false); assert.match(response.headers.get("Cache-Control"), /no-store/); assert.equal(response.headers.get("Content-Type"), "application/pdf");
});
test("invalid slug and foreign storage paths never download", async () => {
  const f = fixture({ existing: true }); assert.equal((await download.serveReviewedPdf(f.client, "../test", true)).status, 404);
  f.db.article_reviewed_works[0].pdf_storage_path = oldPath.replace(articleId, workId);
  assert.equal((await download.serveReviewedPdf(f.client, "test-article", false)).status, 404); assert.equal(f.calls.some(c => c.op === "download"), false);
});
test("download failures are sanitized without hiding article content", async () => {
  const f = fixture({ existing: true }); f.failures.download = true;
  const response = await download.serveReviewedPdf(f.client, "test-article", false); assert.equal(response.status, 503); assert.doesNotMatch(await response.text(), /private/);
});
test("create flow saves article first, sends PDF separately, and uses returned article ID", async () => {
  const f = fixture(); f.db.articles = []; const calls = []; const data = form(); data.set("cover_file", new File(["image"], "cover.png"));
  const result = await submit.submitReviewedArticle(data, async articleForm => {
    calls.push("article"); assert.equal(articleForm.has("reviewed_pdf"), false); assert.ok(articleForm.has("cover_file"));
    f.db.articles.push({ id: articleId, status: "draft" }); return { success: "saved", id: articleId };
  }, async (id, pdfForm) => { calls.push("pdf"); assert.equal(id, articleId); assert.equal(pdfForm.has("cover_file"), false); return mutation.saveReviewedWork(f.client, id, pdfForm); }, () => {});
  assert.deepEqual(calls, ["article", "pdf"]); assert.ok(result.success); assert.equal(result.error, undefined); assert.equal(f.db.article_reviewed_works.length, 1);
});
test("partial PDF failure reports saved article ID for safe retry", async () => {
  const result = await submit.submitReviewedArticle(form(), async () => ({ success: "saved", id: articleId }), async () => { throw Error("network"); }, () => {});
  assert.equal(result.id, articleId); assert.ok(result.success); assert.match(result.error, /Reopen the saved article/);
});
test("preflight rejects invalid PDF before saving article", async () => {
  let saved = false; const result = await submit.submitReviewedArticle(form({}, file("invalid")), async () => { saved = true; }, async () => {}, () => {});
  assert.ok(result.errors.reviewed_pdf); assert.equal(saved, false);
});
test("article save failure does not attempt PDF upload", async () => {
  let uploaded = false; const result = await submit.submitReviewedArticle(form(), async () => ({ error: "Save failed" }), async () => { uploaded = true; }, () => {});
  assert.equal(result.error, "Save failed"); assert.equal(uploaded, false);
});
test("missing migration prevents attaching a PDF before changing article data", async () => {
  const f = fixture(); f.failures.missing = true;
  assert.match((await mutation.prepareArticleWithReviewedWork(f.client, null, form())).error, /Phase 3 migration/);
  assert.equal(f.calls.some(c => c.op !== "select"), false);
});

test("long Unicode filename is safely truncated without breaking a code point", () => {
  const disposition = download.pdfDisposition("a".repeat(169) + "📚.pdf", true);
  assert.match(disposition, /%F0%9F%93%9A/);
});
test("article deletion cleans cascaded PDF and retains existing cover deletion workflow", async () => {
  const f = fixture({ existing: true }); let coverDeleted = false;
  const wrapped = load("src/lib/journal/reviewed-work-mutations.ts", { "./cover-mutations": { deleteArticleWithCover: async () => { coverDeleted = true; f.db.articles = []; f.db.article_reviewed_works = []; return { success: "Deleted" }; } } });
  const input = form(); input.set("confirm", "yes");
  assert.ok((await wrapped.deleteArticleWithReviewedPdf(f.client, articleId, input)).success); assert.ok(coverDeleted); assert.equal(f.objects.size, 0);
});
