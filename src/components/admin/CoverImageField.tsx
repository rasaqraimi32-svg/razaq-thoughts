"use client";
import { useEffect, useRef, useState } from "react";
import { COVER_ACCEPT, COVER_TYPES, MAX_COVER_BYTES } from "@/lib/journal/cover-settings";
import styles from "@/app/admin/admin.module.css";

export default function CoverImageField({ currentUrl, pending, error }: { currentUrl?: string | null; pending: boolean; error?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [selection, setSelection] = useState<{ url: string; name: string } | null>(null);
  const [intent, setIntent] = useState("keep");
  const [localError, setLocalError] = useState("");
  useEffect(() => () => { if (selection) URL.revokeObjectURL(selection.url); }, [selection]);
  const preview = selection?.url ?? (intent === "keep" ? currentUrl : null);
  return <div className={styles.coverField}>
    <label htmlFor="article-cover">Front-page image <span>(optional)</span></label>
    <p id="cover-help" className="muted-note">JPG, PNG or WebP · up to 3 MB and 24 megapixels. Used on the homepage and catalogue. Cover images are public assets, including for drafts. This is not a PDF attachment.</p>
    <input type="hidden" name="cover_intent" value={intent} />
    <input ref={input} id="article-cover" name="cover_file" type="file" accept={COVER_ACCEPT} aria-describedby="cover-help cover-status" aria-invalid={Boolean(localError || error)} onChange={event => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (!/\.(jpe?g|png|webp)$/i.test(file.name) || (file.type && !COVER_TYPES.includes(file.type)) || !file.size || file.size > MAX_COVER_BYTES) {
        event.target.value = ""; setSelection(null); setIntent("keep"); setLocalError("Choose a JPG, PNG or WebP image, up to 3 MB."); return;
      }
      setSelection({ url: URL.createObjectURL(file), name: file.name }); setIntent("replace"); setLocalError("");
    }} />
    {preview && <div className={styles.coverPreview}>
      {/* A local blob URL or existing cover is shown directly without cropping. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={preview} alt="Front-page image preview" />
      <p>{selection?.name ?? "Current front-page image"}</p>
    </div>}
    <div className={styles.coverControls}>
      {preview && <button type="button" className="text-link" onClick={() => input.current?.click()}>Replace image</button>}
      {preview && <button type="button" className="text-link" onClick={() => { if (input.current) input.current.value = ""; setSelection(null); setIntent("remove"); setLocalError(""); }}>Remove image</button>}
      {currentUrl && intent !== "keep" && <button type="button" className="text-link" onClick={() => { if (input.current) input.current.value = ""; setSelection(null); setIntent("keep"); setLocalError(""); }}>Keep current image</button>}
    </div>
    <p id="cover-status" role="status" className="muted-note">{pending ? "Validating image, uploading and saving…" : intent === "remove" ? "Image will be removed when you save." : selection ? "Selected image will upload when you save. If saving fails, select it again before retrying." : !preview ? "No front-page image selected. A neutral placeholder will be used." : "Choose another image to replace this cover when you save."}</p>
    {(localError || error) && <p className={styles.error} role="alert">{localError || error}</p>}
  </div>;
}
