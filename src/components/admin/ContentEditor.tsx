"use client";
/** The editor owns only the plain-text content value; a future editor can replace it. */
export default function ContentEditor({ value, onChange, invalid }: { value: string; onChange: (value: string) => void; invalid: boolean }) {
  return <div className="form-field"><label htmlFor="article-content">Content</label><textarea id="article-content" name="content" rows={18} required maxLength={100000} value={value} onChange={event => onChange(event.target.value)} aria-invalid={invalid} aria-describedby="content-help" /><p id="content-help" className="muted-note">Plain text. Separate paragraphs with a blank line. HTML is displayed as text.</p></div>;
}
