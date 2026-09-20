"use client";
import { useActionState } from "react";
import { deleteArticleAction, deleteCategoryAction } from "@/app/admin/(protected)/article-actions";
import FormFeedback from "./FormFeedback";
import styles from "@/app/admin/admin.module.css";
export default function DeleteForm({ id, title, kind }: { id: string; title: string; kind: "article" | "category" }) {
  const handler = kind === "article" ? deleteArticleAction : deleteCategoryAction;
  const [state, action, pending] = useActionState(handler.bind(null, id), {});
  return <details className={styles.deleteBox}><summary>Delete <span className="sr-only">{title}</span></summary><form action={action} aria-busy={pending}><p>Delete “{title}” permanently?</p><p className="muted-note">{kind === "article" ? "This cannot be undone. Any associated comments will also be permanently deleted." : "Only an unused category can be deleted. Reassign its articles first."}</p><FormFeedback state={state} /><label className={styles.checkbox}><input type="checkbox" name="confirm" value="yes" required disabled={pending} /> I confirm this permanent deletion.</label><button className={styles.danger} type="submit" disabled={pending}>{pending ? "Deleting…" : "Confirm deletion"}</button></form></details>;
}
