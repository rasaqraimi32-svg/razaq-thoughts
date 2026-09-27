"use client";
import { useActionState } from "react";
import { cleanupReviewedPdfsAction } from "@/app/admin/(protected)/reviewed-work-actions";
import FormFeedback from "./FormFeedback";
import styles from "@/app/admin/admin.module.css";
export default function PdfCleanupForm() {
  const [state, action, pending] = useActionState(cleanupReviewedPdfsAction, {});
  return <details className={styles.coverCleanup}><summary>PDF maintenance</summary><p className="muted-note">Retry cleanup after an interrupted PDF upload or deletion. Files attached to any article and uploads less than 24 hours old are kept.</p><form action={action} aria-busy={pending}><FormFeedback state={state} /><button className="text-link" disabled={pending}>{pending ? "Checking unused PDFs…" : "Clean up unused PDFs"}</button></form></details>;
}
