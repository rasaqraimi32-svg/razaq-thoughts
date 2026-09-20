"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { saveArticleAction } from "@/app/admin/(protected)/article-actions";
import type { ArticleRecord, Category } from "@/lib/journal/types";
import { slugify } from "@/lib/journal/validation";
import ContentEditor from "./ContentEditor";
import FormFeedback from "./FormFeedback";
import styles from "@/app/admin/admin.module.css";

export default function ArticleForm({ article, categories }: { article?: ArticleRecord; categories: Category[] }) {
  const [state, action, pending] = useActionState(saveArticleAction.bind(null, article?.id ?? null), {});
  const [values, setValues] = useState({ title: article?.title ?? "", slug: article?.slug ?? "", excerpt: article?.excerpt ?? "", content: article?.content ?? "", category_id: article?.category_id ?? "", author_name: article?.author_name ?? "Razaq", reading_time: article?.reading_time?.toString() ?? "", cover_image_url: article?.cover_image_url ?? "", status: article?.status ?? "draft", featured: article?.featured ?? false });
  const [manualSlug, setManualSlug] = useState(Boolean(article));
  const change = (key: string, value: string | boolean) => setValues(current => ({ ...current, [key]: value }));
  return <form action={action} className={styles.editor} aria-busy={pending}>
    <input type="hidden" name="slug_mode" value={manualSlug ? "manual" : "auto"} />
    {article && <input type="hidden" name="updated_at" value={article.updated_at} />}
    <FormFeedback state={state} />
    <fieldset disabled={pending} className={styles.fields}>
      <div className="form-field"><label htmlFor="article-title">Title</label><input id="article-title" name="title" required maxLength={250} value={values.title} aria-invalid={Boolean(state.errors?.title)} onChange={event => { const title = event.target.value; setValues(current => ({ ...current, title, slug: manualSlug ? current.slug : slugify(title) })); }} /></div>
      <div className="form-field"><label htmlFor="article-slug">URL slug</label><input id="article-slug" name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={180} value={values.slug} aria-invalid={Boolean(state.errors?.slug)} onChange={event => { setManualSlug(true); change("slug", event.target.value); }} aria-describedby="slug-help" /><p className="muted-note" id="slug-help">/articles/{values.slug || "your-article"}. {article ? "Changing this will change the article’s public address." : "Generated from the title; duplicate generated slugs receive a number. You can edit it."}</p></div>
      <div className={styles.twoColumns}>
        <div className="form-field"><label htmlFor="article-category">Category</label><select id="article-category" name="category_id" required value={values.category_id} aria-invalid={Boolean(state.errors?.category_id)} onChange={event => change("category_id", event.target.value)}><option value="">Choose a category</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select>{!categories.length && <p className="muted-note">Create a category before saving an article.</p>}</div>
        <div className="form-field"><label htmlFor="article-status">Status</label><select id="article-status" name="status" value={values.status} onChange={event => change("status", event.target.value)}><option value="draft">Draft</option><option value="published">Published</option>{article && <option value="archived">Archived</option>}</select><p className="muted-note">Only published articles are visible to readers.</p></div>
      </div>
      <div className="form-field"><label htmlFor="article-excerpt">Excerpt</label><textarea id="article-excerpt" name="excerpt" rows={3} required maxLength={1000} value={values.excerpt} onChange={event => change("excerpt", event.target.value)} aria-invalid={Boolean(state.errors?.excerpt)} /></div>
      <ContentEditor value={values.content} onChange={value => change("content", value)} invalid={Boolean(state.errors?.content)} />
      <div className={styles.twoColumns}>
        <div className="form-field"><label htmlFor="article-author">Author name</label><input id="article-author" name="author_name" required maxLength={150} value={values.author_name} onChange={event => change("author_name", event.target.value)} aria-invalid={Boolean(state.errors?.author_name)} /></div>
        <div className="form-field"><label htmlFor="article-reading">Reading time <span>(minutes, optional)</span></label><input id="article-reading" name="reading_time" type="number" min={1} max={10000} step={1} value={values.reading_time} onChange={event => change("reading_time", event.target.value)} aria-invalid={Boolean(state.errors?.reading_time)} /><p className="muted-note">Leave blank to calculate from the content.</p></div>
      </div>
      <div className="form-field"><label htmlFor="article-cover">Cover image URL <span>(optional)</span></label><input id="article-cover" name="cover_image_url" type="url" maxLength={2048} placeholder="https://…" value={values.cover_image_url} onChange={event => change("cover_image_url", event.target.value)} aria-invalid={Boolean(state.errors?.cover_image_url)} /></div>
      <label className={styles.checkbox}><input type="checkbox" name="featured" checked={values.featured} onChange={event => change("featured", event.target.checked)} /> Feature this article</label>
      <div className={styles.actions}><button className="button" type="submit" disabled={!categories.length}>{pending ? "Saving…" : values.status === "published" ? "Save and publish" : "Save article"}</button><Link className="text-link" href="/admin/articles">Cancel</Link></div>
    </fieldset>
  </form>;
}
