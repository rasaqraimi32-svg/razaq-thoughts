"use client";
import { useRef, useState } from "react";
import { MAX_PDF_BYTES, type ReviewedWork } from "@/lib/journal/reviewed-work";
import styles from "@/app/admin/admin.module.css";
export default function ReviewedWorkFields({ work, available }: { work: ReviewedWork | null; available: boolean }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(work?.title ?? "");
  const [author, setAuthor] = useState(work?.author_name ?? "");
  const [intent, setIntent] = useState("keep");
  const [selection, setSelection] = useState<{ name: string; size: number } | null>(null);
  const [error, setError] = useState("");
  const changed = intent !== "keep" || title !== (work?.title ?? "") || author !== (work?.author_name ?? "");
  function resetFile() { if (fileInput.current) fileInput.current.value = ""; setSelection(null); setError(""); }
  return <fieldset className={styles.reviewedFields} disabled={!available}>
    <legend>Work Under Review <span>(optional)</span></legend>
    <p className="muted-note">The original work your article discusses. Its PDF and author are separate from your article and its front-page image. Only upload a work you have the right or permission to distribute.</p>
    {!available && <p role="status" className={styles.error}>PDF attachments are unavailable. Apply the Phase 3 Supabase migration, or retry later. You can still save your article and front-page image.</p>}
    <input type="hidden" name="reviewed_changed" value={changed ? "yes" : "no"} />
    <input type="hidden" name="reviewed_intent" value={intent} />
    <input type="hidden" name="reviewed_version" value={work?.updated_at ?? "none"} />
    <div className="form-field"><label htmlFor="reviewed-title">Title of work</label><input id="reviewed-title" name="reviewed_title" maxLength={300} value={title} onChange={event => { setTitle(event.target.value); if (intent === "remove") setIntent("keep"); }} /></div>
    <div className="form-field"><label htmlFor="reviewed-author">Original author</label><input id="reviewed-author" name="reviewed_author" maxLength={200} value={author} onChange={event => { setAuthor(event.target.value); if (intent === "remove") setIntent("keep"); }} /></div>
    <div className="form-field"><label htmlFor="reviewed-pdf">PDF of the original work</label><input ref={fileInput} id="reviewed-pdf" name="reviewed_pdf" type="file" accept=".pdf,application/pdf" aria-describedby="reviewed-pdf-help reviewed-pdf-status" aria-invalid={Boolean(error)} onChange={event => {
      const file = event.target.files?.[0]; if (!file) return;
      if (!/\.pdf$/i.test(file.name) || (file.type && file.type !== "application/pdf") || !file.size || file.size > MAX_PDF_BYTES) { resetFile(); setIntent("keep"); setError("Choose a PDF up to 3 MB. Images and Word files are not accepted."); return; }
      setSelection({ name: file.name, size: file.size }); setIntent("replace"); setError("");
    }} /><p id="reviewed-pdf-help" className="muted-note">PDF only · up to 3 MB. Uploads when you save, after the article has been saved.</p></div>
    <p id="reviewed-pdf-status" role="status">{selection ? selection.name + " · " + (selection.size / 1024).toFixed(1) + " KB · selected for upload" : intent === "remove" ? "The reviewed work and PDF will be removed when you save." : work ? "Current PDF: " + work.pdf_original_filename : "No PDF attached."}</p>
    <div className={styles.coverControls}>
      {(selection || (work && intent !== "remove")) && <button type="button" className="text-link" onClick={() => fileInput.current?.click()}>Replace PDF</button>}
      {selection && <button type="button" className="text-link" onClick={() => { resetFile(); setIntent("keep"); }}>Clear selected PDF</button>}
      {work && intent !== "remove" && <button type="button" className="text-link" onClick={() => { resetFile(); setIntent("remove"); setTitle(""); setAuthor(""); }}>Remove reviewed work and PDF</button>}
      {work && intent === "remove" && <button type="button" className="text-link" onClick={() => { setIntent("keep"); setTitle(work.title); setAuthor(work.author_name); }}>Keep current reviewed work</button>}
    </div>
    {error && <p className={styles.error} role="alert">{error}</p>}
  </fieldset>;
}
