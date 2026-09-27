/** Versioned JSON in articles.content; unmarked text is always legacy plain text. */
export const RICH_CONTENT_PREFIX = "RAZAQ-RICH-TEXT/1\n";
export const MAX_CONTENT_TEXT = 100000;
export const MAX_RICH_STORAGE = 500000;
export type RichMark = { type: "bold" | "italic" | "underline" | "link"; attrs?: { href: string } };
export type RichNode = { type: string; text?: string; attrs?: { level?: number; start?: number; textAlign?: "left" | "justify" }; marks?: RichMark[]; content?: RichNode[] };
export type RichDocument = RichNode & { type: "doc"; content: RichNode[] };
const blocks = new Set(["paragraph", "heading", "bulletList", "orderedList", "blockquote", "horizontalRule"]);
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

export function safeLinkHref(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048 || /[\u0000-\u0020\u007f]/.test(value)) return null;
  try {
    const url = new URL(value);
    if (!["https:", "http:", "mailto:"].includes(url.protocol) || url.username || url.password) return null;
    if (url.protocol === "mailto:" && (!url.pathname || /%0[ad]/i.test(value))) return null;
    return value;
  } catch { return null; }
}

/** Rebuild from an allowlist. No arbitrary attributes, HTML, CSS or executable nodes survive. */
export function sanitizeRichDocument(input: unknown): RichDocument {
  let count = 0, textLength = 0;
  function visit(value: unknown, parent: string, depth: number): RichNode {
    if (!object(value) || typeof value.type !== "string" || depth > 20 || ++count > 20000) throw new Error("Invalid or overly complex rich-text content.");
    const type = value.type;
    const allowed = parent === "root" ? type === "doc" : ["paragraph", "heading"].includes(parent) ? ["text", "hardBreak"].includes(type) : ["bulletList", "orderedList"].includes(parent) ? type === "listItem" : blocks.has(type);
    if (!allowed) throw new Error("Unsupported rich-text structure.");
    if (type === "text") {
      if (typeof value.text !== "string" || !value.text.length) throw new Error("Invalid text node.");
      textLength += value.text.length;
      if (textLength > MAX_CONTENT_TEXT) throw new Error("Content must be at most 100000 text characters.");
      const marks: RichMark[] = [];
      if (Array.isArray(value.marks)) for (const mark of value.marks) {
        if (!object(mark) || marks.some(m => m.type === mark.type)) continue;
        if (["bold", "italic", "underline"].includes(String(mark.type))) marks.push({ type: mark.type as RichMark["type"] });
        if (mark.type === "link" && object(mark.attrs)) {
          const href = safeLinkHref(mark.attrs.href); if (href) marks.push({ type: "link", attrs: { href } });
        }
      }
      return { type, text: value.text, ...(marks.length ? { marks } : {}) };
    }
    if (["hardBreak", "horizontalRule"].includes(type)) return { type };
    const content = Array.isArray(value.content) ? value.content.map(child => visit(child, type, depth + 1)) : [];
    if (["doc", "blockquote", "bulletList", "orderedList", "listItem"].includes(type) && !content.length) throw new Error("Empty rich-text structure.");
    if (type === "listItem" && content[0].type !== "paragraph") throw new Error("List items must start with a paragraph.");
    const attrs: RichNode["attrs"] = {};
    if (["paragraph", "heading"].includes(type) && object(value.attrs) && (value.attrs.textAlign === "left" || value.attrs.textAlign === "justify")) {
      attrs.textAlign = value.attrs.textAlign;
    }
    if (type === "heading") {
      const level = object(value.attrs) ? value.attrs.level : 1;
      if (![1, 2, 3].includes(Number(level))) throw new Error("Use heading levels 1, 2 or 3.");
      attrs.level = Number(level);
    }
    if (type === "orderedList") {
      const start = object(value.attrs) ? value.attrs.start ?? 1 : 1;
      attrs.start = typeof start === "number" && Number.isInteger(start) && start > 0 && start <= 100000 ? start : 1;
    }
    return { type, ...(Object.keys(attrs).length ? { attrs } : {}), content };
  }
  return visit(input, "root", 0) as RichDocument;
}
export function richTextContent(node: RichNode): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return "\n";
  const separator = ["paragraph", "heading"].includes(node.type) ? "" : "\n\n";
  return (node.content ?? []).map(richTextContent).join(separator);
}
export function serializeRichContent(document: unknown) {
  const stored = RICH_CONTENT_PREFIX + JSON.stringify(sanitizeRichDocument(document));
  if (stored.length > MAX_RICH_STORAGE) throw new Error("Formatted content is too large. Reduce formatting or split the article.");
  return stored;
}
export function parseRichContent(value: string): RichDocument | null {
  // Multipart form submission normalizes the marker's LF to CRLF.
  const marker = /^RAZAQ-RICH-TEXT\/1\r?\n/.exec(value);
  if (!marker) return null;
  if (value.length > MAX_RICH_STORAGE) throw new Error("Formatted content is too large.");
  return sanitizeRichDocument(JSON.parse(value.slice(marker[0].length)));
}
export function plainTextDocument(value: string): RichDocument {
  const paragraphs = value.replace(/\r\n?/g, "\n").split(/\n\s*\n/);
  return { type: "doc", content: paragraphs.map(paragraph => ({ type: "paragraph", content: paragraph.split("\n").flatMap((line, index) => [ ...(index ? [{ type: "hardBreak" }] : []), ...(line ? [{ type: "text", text: line }] : []) ]) })) };
}
export function editorDocument(value: string): RichDocument {
  try { return parseRichContent(value) ?? plainTextDocument(value); }
  catch { return plainTextDocument(value); } // Never discard malformed stored data on opening.
}
export function validateStoredContent(value: string) {
  const doc = parseRichContent(value);
  if (!doc) {
    if (!value.trim() || value.length > MAX_CONTENT_TEXT) throw new Error("Content is required and must be at most 100000 characters.");
    return value;
  }
  if (!richTextContent(doc).trim()) throw new Error("Write some article content before saving.");
  return serializeRichContent(doc);
}
