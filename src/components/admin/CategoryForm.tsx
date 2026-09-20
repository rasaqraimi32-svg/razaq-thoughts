"use client";
import { useActionState, useId, useState } from "react";
import { saveCategoryAction } from "@/app/admin/(protected)/article-actions";
import type { Category } from "@/lib/journal/types";
import { slugify } from "@/lib/journal/validation";
import FormFeedback from "./FormFeedback";
import styles from "@/app/admin/admin.module.css";
export default function CategoryForm({ category }: { category?: Category }) {
  const [state, action, pending] = useActionState(saveCategoryAction.bind(null, category?.id ?? null), {});
  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [manual, setManual] = useState(Boolean(category));
  const prefix = useId();
  return <form action={action} aria-busy={pending}><FormFeedback state={state} /><fieldset className={styles.fields} disabled={pending}><div className="form-field"><label htmlFor={prefix + "name"}>Category name</label><input id={prefix + "name"} name="name" required maxLength={100} value={name} onChange={event => { setName(event.target.value); if (!manual) setSlug(slugify(event.target.value)); }} aria-invalid={Boolean(state.errors?.name)} /></div><div className="form-field"><label htmlFor={prefix + "slug"}>Category slug</label><input id={prefix + "slug"} name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={180} value={slug} onChange={event => { setManual(true); setSlug(event.target.value); }} aria-invalid={Boolean(state.errors?.slug)} /></div><button className="button button-small" type="submit">{pending ? "Saving…" : category ? "Save category" : "Create category"}</button></fieldset></form>;
}
