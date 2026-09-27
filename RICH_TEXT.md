# Article rich text

The admin Content editor uses Tiptap with paragraph, heading levels 1–3, bold,
italic, underline, bulleted/numbered lists, blockquotes, links, horizontal rules,
hard line breaks and undo/redo. Ctrl/Cmd+B, I and U toggle emphasis; Shift+Enter
adds a line break. The toolbar wraps on mobile.

## Storage and compatibility

No database migration is required. Existing unmarked articles.content values are
plain text and continue to render as escaped paragraphs with preserved line breaks.
Opening an old article or saving metadata does not convert its content.
Editing its body stores a versioned JSON document prefixed by
RAZAQ-RICH-TEXT/1 followed by a newline. New formatted articles use that format.
No existing rows are migrated or rewritten in bulk.

Rich documents are limited to 100,000 text characters, 500,000 serialized
characters, 20,000 nodes and 20 nesting levels. Empty and malformed documents
are rejected before saving. Automatic reading time counts readable words.

## Paste and rendering

DOMPurify filters pasted HTML. Basic Word/Google Docs emphasis is converted to
semantic marks; fonts, colours, sizes, classes and other document styles are
removed. Paragraphs, line breaks, supported headings, semantic lists, quotes and
safe links survive. Images, tables, advanced document layout and unsupported
formatting are not supported by this writing editor.

Server validation rebuilds stored JSON from an allowlist. Public rendering uses
explicit React elements and escaped text, never raw HTML. Only absolute HTTP,
HTTPS and mailto links without credentials/control characters are permitted.
DOMPurify is a paste convenience; server-side validation is the security boundary.

## Verification

Run TypeScript, node --env-file=.env.local --test tests/*.test.mjs, lint and the
production build. Rich-content tests exercise Tiptap commands and HTML paste,
sanitization, size limits, legacy content, React editor initialization, public
rendering, reading time, and article create/edit mutations.

The Justify toolbar button toggles justified alignment for the current paragraph
or selected paragraphs/headings. Alignment survives saving and public rendering;
only left and justify values are allowed. Ctrl/Cmd+Shift+J also applies justification.
