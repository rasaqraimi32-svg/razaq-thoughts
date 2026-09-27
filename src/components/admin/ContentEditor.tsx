"use client";

import { useEffect, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import TextAlign from "@tiptap/extension-text-align";
import StarterKit from "@tiptap/starter-kit";
import { editorDocument, RICH_CONTENT_PREFIX, safeLinkHref } from "@/lib/journal/rich-content";
import { sanitizePastedHTML } from "@/lib/journal/paste-content";

export default function ContentEditor({ value, onChange, invalid, disabled = false }: {
  value: string; onChange: (value: string) => void; invalid: boolean; disabled?: boolean;
}) {
  const [initialContent] = useState(() => editorDocument(value));
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkURL, setLinkURL] = useState("");
  const [linkError, setLinkError] = useState("");
  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [StarterKit.configure({
      heading: { levels: [1, 2, 3] }, code: false, codeBlock: false, strike: false,
      link: {
        openOnClick: false, defaultProtocol: "https",
        HTMLAttributes: { target: null, rel: "noopener noreferrer" },
        isAllowedUri: (url, context) => context.defaultValidate(url) && Boolean(safeLinkHref(url)),
      },
    }), TextAlign.configure({ types: ["paragraph", "heading"], alignments: ["left", "justify"] })],
    content: initialContent,
    editable: !disabled,
    editorProps: {
      attributes: {
        id: "article-content", role: "textbox", "aria-multiline": "true",
        "aria-labelledby": "content-label", "aria-describedby": "content-help",
        class: "rich-content writing-surface",
      },
      transformPastedHTML: sanitizePastedHTML,
    },
    // Keep the complete draft even if too large; server validation reports errors
    // instead of silently reverting to the last valid version.
    onUpdate: ({ editor }) => onChange(RICH_CONTENT_PREFIX + JSON.stringify(editor.getJSON())),
  });
  useEffect(() => { editor?.setEditable(!disabled, false); }, [editor, disabled]);
  useEffect(() => { editor?.view.dom.setAttribute("aria-invalid", String(invalid)); }, [editor, invalid]);

  const unavailable = !editor || disabled;
  const button = (label: string, action: () => void, active = false, enabled = true) =>
    <button type="button" key={label} aria-pressed={active} disabled={unavailable || !enabled}
      onMouseDown={event => event.preventDefault()} onClick={action}>{label}</button>;
  function applyLink() {
    const href = safeLinkHref(linkURL.trim());
    if (!href) { setLinkError("Enter a complete https://, http:// or mailto: link."); return; }
    editor?.chain().focus().extendMarkRange("link").setLink({ href }).run();
    setLinkOpen(false); setLinkError("");
  }
  return <div className="form-field content-editor">
    <label id="content-label" htmlFor="article-content">Article content</label>
    <input type="hidden" name="content" value={value} />
    <div className="writing-frame">
      <div className="writing-toolbar" role="group" aria-label="Article formatting">
        <label className="visually-hidden" htmlFor="content-style">Text style</label>
        <select id="content-style" disabled={unavailable} aria-label="Text style"
          value={editor?.isActive("heading") ? String(editor.getAttributes("heading").level) : "paragraph"}
          onChange={event => event.target.value === "paragraph" ? editor?.chain().focus().setParagraph().run() : editor?.chain().focus().setHeading({ level: Number(event.target.value) as 1 | 2 | 3 }).run()}>
          <option value="paragraph">Paragraph</option><option value="1">Heading 1</option><option value="2">Heading 2</option><option value="3">Heading 3</option>
        </select>
        {button("Bold", () => editor?.chain().focus().toggleBold().run(), editor?.isActive("bold"))}
        {button("Italic", () => editor?.chain().focus().toggleItalic().run(), editor?.isActive("italic"))}
        {button("Underline", () => editor?.chain().focus().toggleUnderline().run(), editor?.isActive("underline"))}
        {button("Justify", () => editor?.chain().focus().toggleTextAlign("justify").run(), editor?.isActive({ textAlign: "justify" }))}
        {button("Bullets", () => editor?.chain().focus().toggleBulletList().run(), editor?.isActive("bulletList"))}
        {button("Numbered list", () => editor?.chain().focus().toggleOrderedList().run(), editor?.isActive("orderedList"))}
        {button("Quote", () => editor?.chain().focus().toggleBlockquote().run(), editor?.isActive("blockquote"))}
        {button("Link", () => { setLinkURL(editor?.getAttributes("link").href ?? "https://"); setLinkError(""); setLinkOpen(!linkOpen); }, editor?.isActive("link"))}
        {button("Divider", () => editor?.chain().focus().setHorizontalRule().run())}
        {button("Undo", () => editor?.chain().focus().undo().run(), false, editor?.can().undo())}
        {button("Redo", () => editor?.chain().focus().redo().run(), false, editor?.can().redo())}
      </div>
      {linkOpen && <div className="writing-link" role="group" aria-label="Edit hyperlink">
        <label htmlFor="content-link">Link address</label>
        <input id="content-link" type="url" value={linkURL} autoFocus disabled={disabled}
          onChange={event => setLinkURL(event.target.value)} aria-invalid={Boolean(linkError)}
          aria-describedby={linkError ? "link-error" : undefined}
          onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); applyLink(); } if (event.key === "Escape") { event.preventDefault(); setLinkOpen(false); editor?.commands.focus(); } }} />
        <button type="button" disabled={disabled} onClick={applyLink}>Apply link</button>
        <button type="button" disabled={disabled} onClick={() => { editor?.chain().focus().extendMarkRange("link").unsetLink().run(); setLinkOpen(false); }}>Remove link</button>
        <button type="button" onClick={() => { setLinkOpen(false); editor?.commands.focus(); }}>Cancel</button>
        {linkError && <p id="link-error" role="alert">{linkError}</p>}
      </div>}
      {!editor && <p className="muted-note writing-loading">Loading writing editor…</p>}
      <EditorContent editor={editor} />
    </div>
    <p id="content-help" className="muted-note">Paste from Word or Google Docs; basic formatting is preserved and document styles are removed. Use Ctrl/Cmd+B, I or U for emphasis, and Shift+Enter for a line break. Justify toggles alignment for the current paragraph or selected blocks. Maximum 100,000 text characters.</p>
  </div>;
}
