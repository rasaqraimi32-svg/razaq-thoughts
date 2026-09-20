import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
const require = createRequire(import.meta.url);
function load(path, mocks = {}) {
  const source = readFileSync(new URL("../" + path, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const result = { exports: {} };
  vm.runInNewContext(compiled, { module: result, exports: result.exports, URL, require: name => name in mocks ? mocks[name] : require(name) });
  return result.exports;
}
const types = load("src/lib/journal/types.ts");
const article = { id: "public-article", title: "A published perspective", slug: "a-published-perspective", excerpt: "A public excerpt.", category: "Culture", author: "Journal Editor", publishedAt: "2026-09-20T10:00:00Z", readingTime: 3, featured: true, content: [{ type: "paragraph", text: "<script>doNotExecute()</script>" }] };
const component = fn => ({ __esModule: true, default: fn });
const shared = {
  "@/lib/site-metadata": load("src/lib/site-metadata.ts"),
  "@/lib/journal/comment-queries": { getApprovedComments: async () => [] },
  "@/components/CommentForm": component(() => React.createElement("form", { "aria-label": "Submit comment" })),
  "next/link": component(({ href, children, ...props }) => React.createElement("a", { href, ...props }, children)),
  "@/components/ArticleCard": component(({ article }) => React.createElement("a", { href: "/articles/" + article.slug }, article.title)),
  "@/components/FeaturedArticle": component(({ article }) => React.createElement("a", { href: "/articles/" + article.slug }, article.title)),
  "@/components/ArticleCover": component(() => null),
  "@/components/ShareArticle": component(() => React.createElement("button", null, "Copy link")),
  "@/components/CategoryList": component(({ categories }) => React.createElement("p", null, categories.join(", "))),
  "@/components/ReadingCTA": component(() => null),
  "@/components/Arrow": component(() => null),
  "@/lib/journal/types": types,
  "next/navigation": { notFound: () => { throw Error("NOT_FOUND"); } },
  "@/lib/journal/queries": { pageNumber: value => Number(value) || 1, getCategories: async () => [{ id: "category", name: "Culture", slug: "culture" }] },
};
function pages(articles, found = articles[0] ?? null) {
  return { ...shared, "@/lib/journal/public-queries": { getPublishedArticles: async () => ({ articles, count: articles.length }), getPublishedArticle: async () => found } };
}
test("public data mapping uses database category and excludes admin fields", () => {
  const mapped = types.toPublicArticle({ id: "id", title: "Title", slug: "title", excerpt: "Excerpt", content: "First paragraph.\n\nSecond paragraph.", author_name: "Author", categories: { name: "New subject", slug: "new-subject" }, reading_time: null, published_at: "2026-09-20", featured: false, status: "published", updated_at: "private-edit-time" });
  assert.equal(mapped.category, "New subject"); assert.equal(mapped.readingTime, 1); assert.equal(mapped.content.length, 2);
  for (const key of ["status", "updated_at", "category_id", "email"]) assert.equal(key in mapped, false);
});
test("public listing renders database articles without sample editorial copy", async () => {
  const page = load("src/app/articles/page.tsx", pages([article]));
  const html = renderToStaticMarkup(await page.default({ searchParams: Promise.resolve({}) }));
  assert.match(html, /A published perspective/); assert.match(html, /Culture/); assert.doesNotMatch(html, /sample articles|the-art-of-paying-attention/);
});
test("empty database renders helpful homepage and listing states", async () => {
  for (const path of ["src/app/page.tsx", "src/app/articles/page.tsx"]) {
    const page = load(path, pages([]));
    const html = renderToStaticMarkup(await page.default({ searchParams: Promise.resolve({}) }));
    assert.match(html, /New perspectives are on their way/);
  }
});
test("homepage displays published database writing", async () => {
  const page = load("src/app/page.tsx", pages([article]));
  assert.match(renderToStaticMarkup(await page.default()), /A published perspective/);
});
test("detail metadata uses published title, excerpt, author and date", async () => {
  const page = load("src/app/articles/[slug]/page.tsx", pages([article]));
  const metadata = await page.generateMetadata({ params: Promise.resolve({ slug: article.slug }) });
  assert.equal(metadata.title, article.title); assert.equal(metadata.description, article.excerpt);
  assert.equal(metadata.openGraph.publishedTime, article.publishedAt); assert.equal(metadata.openGraph.authors[0], article.author);
});
test("article content is escaped and sharing controls remain", async () => {
  const page = load("src/app/articles/[slug]/page.tsx", pages([article]));
  const html = renderToStaticMarkup(await page.default({ params: Promise.resolve({ slug: article.slug }) }));
  assert.match(html, /&lt;script&gt;/); assert.doesNotMatch(html, /<script>/); assert.match(html, /Copy link/);
});
for (const slug of ["draft-example", "archived-example", "nonexistent-example"]) test("unavailable article uses not-found and does not expose metadata: " + slug, async () => {
  const page = load("src/app/articles/[slug]/page.tsx", pages([], null));
  const props = { params: Promise.resolve({ slug }) };
  await assert.rejects(page.default(props), /NOT_FOUND/);
  assert.equal((await page.generateMetadata(props)).title, "Article not found");
});

test("comment read failure keeps the article, sharing and submission form visible", async () => {
  const page = load("src/app/articles/[slug]/page.tsx", {
    ...pages([article]),
    "@/lib/journal/comment-queries": { getApprovedComments: async () => { throw Error("private database connection detail"); } },
  });
  const html = renderToStaticMarkup(await page.default({ params: Promise.resolve({ slug: article.slug }) }));
  assert.match(html, /A published perspective/);
  assert.match(html, /&lt;script&gt;doNotExecute/);
  assert.match(html, /Copy link/);
  assert.match(html, /aria-label="Submit comment"/);
  assert.match(html, /Comments are temporarily unavailable. Please try again later./);
  assert.doesNotMatch(html, /private database connection detail|No comments yet/);
});

test("successful comment reads retain approved comments and the empty state", async () => {
  for (const comments of [[], [{ id: "comment", name: "A reader", content: "A thoughtful response", createdAt: "2026-09-20T10:00:00Z" }]]) {
    const page = load("src/app/articles/[slug]/page.tsx", {
      ...pages([article]),
      "@/lib/journal/comment-queries": { getApprovedComments: async () => comments },
    });
    const html = renderToStaticMarkup(await page.default({ params: Promise.resolve({ slug: article.slug }) }));
    assert.match(html, comments.length ? /A thoughtful response/ : /No comments yet/);
    assert.doesNotMatch(html, /Comments are temporarily unavailable/);
  }
});

test("article lookup failure is not swallowed by the comment fallback", async () => {
  let commentsRead = false;
  const page = load("src/app/articles/[slug]/page.tsx", {
    ...pages([]),
    "@/lib/journal/public-queries": { getPublishedArticle: async () => { throw Error("Article unavailable"); } },
    "@/lib/journal/comment-queries": { getApprovedComments: async () => { commentsRead = true; return []; } },
  });
  await assert.rejects(page.default({ params: Promise.resolve({ slug: article.slug }) }), /Article unavailable/);
  assert.equal(commentsRead, false);
});
