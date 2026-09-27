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
const rich = load("src/lib/journal/rich-content.ts");
const types = load("src/lib/journal/types.ts", { "./rich-content": rich });
const articleContent = load("src/components/ArticleContent.tsx", { "@/lib/journal/rich-content": rich });
const article = { id: "public-article", title: "A published perspective", slug: "a-published-perspective", excerpt: "A public excerpt.", category: "Culture", author: "Journal Editor", publishedAt: "2026-09-20T10:00:00Z", readingTime: 3, featured: true, content: [{ type: "paragraph", text: "<script>doNotExecute()</script>" }] };
const component = fn => ({ __esModule: true, default: fn });
const shared = {
  "@/components/ArticleContent": articleContent,
  "@/lib/journal/reviewed-work-queries": { getPublishedReviewedWork: async () => null },
  "@/components/ReviewedWork": load("src/components/ReviewedWork.tsx"),
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

// Exercise the real publication components as well as the page-level mocks above.
const artwork = load("src/components/ArticleArtwork.tsx");
const cover = load("src/components/ArticleCover.tsx", { "./ArticleArtwork": artwork });
const publicationComponents = {
  "next/link": shared["next/link"],
  "./ArticleCover": cover,
  "./ArticleMeta": load("src/components/ArticleMeta.tsx", { "@/lib/journal/types": types }),
  "./Arrow": component(() => null),
};
test("publication card keeps one keyboard-accessible article link and full metadata", () => {
  const Card = load("src/components/ArticleCard.tsx", publicationComponents).default;
  const html = renderToStaticMarkup(React.createElement(Card, { article }));
  assert.equal((html.match(/<a /g) ?? []).length, 1);
  assert.match(html, /href="\/articles\/a-published-perspective"/);
  assert.match(html, /<h3>A published perspective<\/h3>/);
  assert.match(html, /Journal Editor/);
  assert.match(html, /A public excerpt/);
  assert.doesNotMatch(html, /tabindex="-1"/);
});
test("publication covers retain original image URLs and provide a neutral fallback", () => {
  const props = { category: "A new subject", title: "A published perspective", author: "Journal Editor" };
  const fallback = renderToStaticMarkup(React.createElement(cover.default, props));
  assert.match(fallback, /Cover image unavailable/);
  assert.doesNotMatch(fallback, /A published perspective|Journal Editor|designed-cover/);
  assert.doesNotMatch(fallback, /<img/);
  const image = renderToStaticMarkup(React.createElement(cover.default, { ...props, url: "https://example.com/book.jpg", priority: true }));
  assert.match(image, /src="https:\/\/example.com\/book.jpg"/);
  assert.match(image, /alt="Cover for A published perspective"/);
  assert.match(image, /loading="eager"/);
});
test("featured publication links its cover to the existing article URL", () => {
  const Featured = load("src/components/FeaturedArticle.tsx", publicationComponents).default;
  const html = renderToStaticMarkup(React.createElement(Featured, { article }));
  assert.match(html, /<a href="\/articles\/a-published-perspective" class="feature-cover-stage" aria-label="Read A published perspective"/);
  assert.match(html, /Read the article/);
});

test("article opens with metadata and content without repeating its cover", async () => {
  const page = load("src/app/articles/[slug]/page.tsx", {
    ...pages([{ ...article, coverImageUrl: "https://example.com/cover.jpg" }]),
    "@/components/ArticleCover": component(() => { throw Error("Detail cover must not render"); }),
  });
  const html = renderToStaticMarkup(await page.default({ params: Promise.resolve({ slug: article.slug }) }));
  assert.match(html, /<h1>A published perspective<\/h1>/);
  assert.match(html, /A public excerpt/);
  assert.match(html, /Journal Editor/);
  assert.match(html, /3 min read/);
  assert.match(html, /href="#discussion"/);
  assert.match(html, /&lt;script&gt;doNotExecute/);
  assert.match(html, /aria-label="Submit comment"/);
  assert.doesNotMatch(html, /detail-cover-stage|<img/);
});

const reviewedWork = { id: "work", article_id: article.id, title: "An Original Treatise", author_name: "Original Author", pdf_original_filename: "original-work.pdf", pdf_storage_path: "private/path.pdf" };
test("reviewed work appears after content and before sharing with original attribution", async () => {
  const page = load("src/app/articles/[slug]/page.tsx", { ...pages([article]), "@/lib/journal/reviewed-work-queries": { getPublishedReviewedWork: async () => reviewedWork } });
  const html = renderToStaticMarkup(await page.default({ params: Promise.resolve({ slug: article.slug }) }));
  assert.match(html, /Work Under Review/); assert.match(html, /Original Author/); assert.match(html, /original-work.pdf/);
  assert.match(html, /href="\/articles\/a-published-perspective\/reviewed-work"/);
  assert.match(html, /href="\/articles\/a-published-perspective\/reviewed-work\?download=1"/);
  assert.ok(html.indexOf("&lt;script&gt;") < html.indexOf("Work Under Review"));
  assert.ok(html.indexOf("Work Under Review") < html.indexOf("Copy link"));
  assert.doesNotMatch(html, /private\/path.pdf/);
});
test("no PDF produces no empty reviewed-work section, including during attachment outage", async () => {
  for (const getPublishedReviewedWork of [async () => null, async () => { throw Error("private detail"); }]) {
    const page = load("src/app/articles/[slug]/page.tsx", { ...pages([article]), "@/lib/journal/reviewed-work-queries": { getPublishedReviewedWork } });
    const html = renderToStaticMarkup(await page.default({ params: Promise.resolve({ slug: article.slug }) }));
    assert.doesNotMatch(html, /Work Under Review|View PDF|private detail/); assert.match(html, /Copy link/); assert.match(html, /Submit comment/);
  }
});

test("public detail renders formatted content with semantic headings, lists and safe links", async () => {
  const doc = { type: "doc", content: [
    ...[1, 2, 3].map(level => ({ type: "heading", attrs: { level }, content: [{ type: "text", text: "Section " + level }] })),
    { type: "paragraph", content: [{ type: "text", text: "Emphasis", marks: [{ type: "bold" }, { type: "italic" }, { type: "underline" }] }, { type: "hardBreak" }, { type: "text", text: "Next line" }] },
    ...["bulletList", "orderedList"].map(type => ({ type, content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Item" }] }] }] })),
    { type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "Quotation" }] }] },
    { type: "horizontalRule" },
    { type: "paragraph", content: [{ type: "text", text: "Reference", marks: [{ type: "link", attrs: { href: "https://example.org/paper" } }] }] }
  ] };
  const page = load("src/app/articles/[slug]/page.tsx", pages([{ ...article, richContent: doc }]));
  const html = renderToStaticMarkup(await page.default({ params: Promise.resolve({ slug: article.slug }) }));
  for (const tag of ["h1", "h2", "h3", "p", "strong", "em", "u", "ul", "ol", "li", "blockquote", "hr", "br"]) assert.match(html, new RegExp("<" + tag + "(?: |/?>)"));
  assert.ok(html.includes('href="https://example.org/paper"'));
  assert.match(html, /Submit comment/);
  assert.match(html, /Copy link/);
});
test("rich public renderer escapes HTML text and ignores unsafe link attributes", () => {
  const doc = { type: "doc", content: [{ type: "paragraph", attrs: { onclick: "alert(1)" }, content: [{ type: "text", text: "<img src=x onerror=alert(1)>", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }] }] };
  const html = renderToStaticMarkup(React.createElement(articleContent.default, { article: { content: [], richContent: doc } }));
  assert.match(html, /&lt;img/); assert.doesNotMatch(html, /<img|<a |onclick=/);
});
test("automatic reading time counts rich article words instead of JSON syntax", () => {
  const content = rich.serializeRichContent({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "word ".repeat(401) }] }] });
  const mapped = types.toPublicArticle({ ...article, content, reading_time: null, created_at: article.publishedAt });
  assert.equal(mapped.readingTime, 3); assert.equal(mapped.richContent.type, "doc");
});

test("public rendering preserves justified paragraphs and headings safely", () => {
  const richContent = { type: "doc", content: [
    { type: "paragraph", attrs: { textAlign: "justify" }, content: [{ type: "text", text: "Justified paragraph" }] },
    { type: "heading", attrs: { level: 2, textAlign: "justify" }, content: [{ type: "text", text: "Justified heading" }] },
    { type: "paragraph", attrs: { textAlign: "justify; color:red" }, content: [{ type: "text", text: "Unsafe alignment stripped" }] },
  ] };
  const html = renderToStaticMarkup(React.createElement(articleContent.default, { article: { content: [], richContent } }));
  assert.ok(html.includes('<p style="text-align:justify">Justified paragraph</p>'));
  assert.ok(html.includes('<h2 style="text-align:justify">Justified heading</h2>'));
  assert.ok(html.includes('<p>Unsafe alignment stripped</p>'));
});

test("CRLF rich content from a published row renders formatting instead of its storage JSON", () => {
  const content = "RAZAQ-RICH-TEXT/1\r\n" + JSON.stringify({ type: "doc", content: [{ type: "paragraph", attrs: { textAlign: "justify" }, content: [{ type: "text", text: "A published argument.", marks: [{ type: "bold" }] }] }] });
  const mapped = types.toPublicArticle({ ...article, content, reading_time: null, created_at: article.publishedAt });
  const html = renderToStaticMarkup(React.createElement(articleContent.default, { article: mapped }));
  assert.ok(html.includes('<p style="text-align:justify"><strong>A published argument.</strong></p>'));
  assert.doesNotMatch(html, /RAZAQ-RICH-TEXT|&quot;type&quot;/);
});
