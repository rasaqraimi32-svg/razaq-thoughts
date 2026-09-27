"use client";
import { useActionState } from "react";
import { cleanupCoverImagesAction } from "@/app/admin/(protected)/article-actions";
import FormFeedback from "./FormFeedback";
import styles from "@/app/admin/admin.module.css";
export default function CoverCleanupForm() {
  const [state, action, pending] = useActionState(cleanupCoverImagesAction, {});
  return <details className={styles.coverCleanup}><summary>Image maintenance</summary><p className="muted-note">Retry cleanup after an interrupted upload or Storage outage. Images used by any article are kept; unused uploads must be at least 24 hours old.</p><form action={action} aria-busy={pending}><FormFeedback state={state} /><button className="text-link" disabled={pending}>{pending ? "Checking unused images…" : "Clean up unused images"}</button></form></details>;
}
