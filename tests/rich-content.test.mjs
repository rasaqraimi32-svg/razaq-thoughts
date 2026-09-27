import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import { JSDOM } from "jsdom";
const require = createRequire(import.meta.url);
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://example.org" });
for (const name of ["window", "document", "Node", "HTMLElement", "Element", "MutationObserver", "DOMParser", "getComputedStyle"]) {
  Object.defineProperty(globalThis, name, { configurable: true, value: name === "getComputedStyle" ? dom.window.getComputedStyle.bind(dom.window) : dom.window[name] });
}
Object.defineProperty(globalThis, "navigator", { configurable: true, value: dom.window.navigator });
globalThis.requestAnimationFrame = callback => setTimeout(callback, 0);
globalThis.cancelAnimationFrame = clearTimeout;
function load(path, mocks = {}) {
  const compiled = ts.transpileModule(readFileSync(new URL("../" + path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const result = { exports: {} };
  vm.runInNewContext(compiled, { module: result, exports: result.exports, URL, document: dom.window.document, require: name => name in mocks ? mocks[name] : require(name) });
  return result.exports;
}
const rich = load("src/lib/journal/rich-content.ts");
const paste = load("src/lib/journal/paste-content.ts", { "./rich-content": rich });
const { Editor } = await import("@tiptap/react");
const { default: StarterKit } = await import("@tiptap/starter-kit");
const { default: TextAlign } = await import("@tiptap/extension-text-align");
function editor(content = "") {
  return new Editor({
    element: document.createElement("div"),
    extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3] }, code: false, codeBlock: false, strike: false, link: { defaultProtocol: "https", openOnClick: false, isAllowedUri: url => Boolean(rich.safeLinkHref(url)) } }), TextAlign.configure({ types: ["paragraph", "heading"], alignments: ["left", "justify"] })],
    content, editorProps: { transformPastedHTML: paste.sanitizePastedHTML },
  });
}
const paragraph = text => ({ type: "paragraph", content: [{ type: "text", text }] });
test("legacy plain text stays literal, with paragraphs and line breaks", () => {
  const text = "First line\nSecond line\n\n<script>literal</script>";
  assert.equal(rich.parseRichContent(text), null);
  const doc = rich.plainTextDocument("First line\nSecond line\n\n<script>literal</script>");
  assert.equal(doc.content.length, 2);
  assert.equal(doc.content[0].content[1].type, "hardBreak");
  assert.equal(doc.content[1].content[0].text, "<script>literal</script>");
  assert.equal(rich.validateStoredContent(text), text);
});
test("malformed JSON is rejected on save but preserved when opening for repair", () => {
  const text = rich.RICH_CONTENT_PREFIX + "{bad";
  assert.throws(() => rich.validateStoredContent(text));
  assert.equal(rich.richTextContent(rich.editorDocument(text)), text);
});
test("rich content validates size, structure, heading levels and empty documents", () => {
  for (const doc of [
    { type: "doc", content: [paragraph("x".repeat(100001))] },
    { type: "doc", content: [{ type: "heading", attrs: { level: 6 }, content: [{ type: "text", text: "Bad level" }] }] },
    { type: "doc", content: [{ type: "script", text: "alert(1)" }] },
    { type: "doc", content: [{ type: "text", text: "No paragraph" }] },
    { type: "doc", content: [{ type: "listItem", content: [paragraph("Bad placement")] }] }
  ]) assert.throws(() => rich.serializeRichContent(doc));
  assert.throws(() => rich.validateStoredContent(rich.serializeRichContent({ type: "doc", content: [{ type: "paragraph" }] })));
  assert.throws(() => rich.parseRichContent(rich.RICH_CONTENT_PREFIX + " ".repeat(500000)));
});
test("links allow web and mailto references while excluding executable or credentialed URLs", () => {
  for (const href of ["https://example.org/paper?q=1#p2", "http://example.org", "mailto:author@example.org"]) assert.equal(rich.safeLinkHref(href), href);
  for (const href of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,test", "//evil.org", "https://user:pass@example.org", "java\nscript:evil()", "mailto:a@b.com?body=%0Aevil", "file:///etc/passwd"]) assert.equal(rich.safeLinkHref(href), null);
});
test("Word/Docs-like paste preserves structure and emphasis while stripping CSS and unsafe HTML", () => {
  const clean = paste.sanitizePastedHTML('<b style="font-weight:normal"><h2 style="font-size:99px">A heading</h2><p class="MsoNormal" style="color:red">First <span style="font-weight:700;font-style:italic;text-decoration:underline">emphasis</span></p><p>Second<br>line</p><ul><li>Bullet</li></ul><ol start="3"><li>Third</li></ol><blockquote><p>Quote</p></blockquote><hr><p><a href="https://example.org">Source</a><a href="javascript:alert(1)" onclick="evil()">Unsafe</a></p><img src=x onerror=evil()><script>alert(1)</script><iframe src="https://evil.org"></iframe></b>');
  assert.doesNotMatch(clean, /style=|class=|onclick|onerror|<script|<img|<iframe|javascript:/i);
  const instance = editor(clean);
  try {
    const doc = rich.parseRichContent(rich.serializeRichContent(instance.getJSON()));
    assert.equal(doc.content[0].type, "heading"); assert.equal(doc.content[0].attrs.level, 2);
    assert.equal(doc.content[0].content[0].marks, undefined);
    const emphasized = doc.content[1].content.find(node => node.text === "emphasis");
    assert.deepEqual(Array.from(emphasized.marks, mark => mark.type).sort(), ["bold", "italic", "underline"]);
    for (const type of ["bulletList", "orderedList", "blockquote", "horizontalRule"]) assert.ok(doc.content.some(node => node.type === type));
    assert.equal(doc.content.find(node => node.type === "orderedList").attrs.start, 3);
    assert.ok(doc.content[2].content.some(node => node.type === "hardBreak"));
    assert.match(instance.getHTML(), /href="https:\/\/example.org"/);
  } finally { instance.destroy(); }
});
test("actual editor paste pipeline sanitizes and retains separate paragraphs", () => {
  const instance = editor();
  try {
    instance.view.pasteHTML('<h1>Opening</h1><p>First paragraph</p><p><strong>Second</strong> paragraph</p><p><a href="javascript:evil()">Bad link</a></p>', new dom.window.Event('paste'));
    const stored = rich.serializeRichContent(instance.getJSON());
    assert.doesNotMatch(stored, /javascript/);
    const doc = rich.parseRichContent(stored);
    assert.equal(doc.content[0].type, "heading");
    assert.ok(rich.richTextContent(doc).includes("First paragraph\n\nSecond paragraph"));
  } finally { instance.destroy(); }
});
test("editor formatting commands, undo/redo, and saved JSON round trip retain content", () => {
  const instance = editor("<p>Academic writing</p>");
  try {
    instance.commands.selectAll();
    instance.chain().toggleBold().toggleItalic().toggleUnderline().run();
    for (const level of [1, 2, 3]) { instance.commands.setHeading({ level }); assert.equal(instance.getJSON().content[0].attrs.level, level); }
    instance.commands.setParagraph();
    instance.commands.toggleBulletList(); assert.equal(instance.getJSON().content[0].type, "bulletList");
    instance.commands.toggleBulletList();
    instance.commands.toggleOrderedList(); assert.equal(instance.getJSON().content[0].type, "orderedList");
    instance.commands.toggleOrderedList();
    instance.commands.toggleBlockquote(); assert.equal(instance.getJSON().content[0].type, "blockquote");
    instance.commands.toggleBlockquote();
    instance.commands.setLink({ href: "https://example.org" });
    const saved = rich.serializeRichContent(instance.getJSON());
    const reopened = editor(rich.editorDocument(saved));
    try { assert.equal(rich.serializeRichContent(reopened.getJSON()), saved); } finally { reopened.destroy(); }
    instance.commands.insertContent(" additional");
    const beforeUndo = instance.getText(); instance.commands.undo(); assert.notEqual(instance.getText(), beforeUndo);
    instance.commands.redo(); assert.equal(instance.getText(), beforeUndo);
  } finally { instance.destroy(); }
});

test("mounting and disabling the React editor never rewrites legacy content", async () => {
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const Component = load("src/components/admin/ContentEditor.tsx", {
    "@/lib/journal/rich-content": rich, "@/lib/journal/paste-content": paste,
  }).default;
  const host = document.createElement("div"); document.body.appendChild(host);
  const root = createRoot(host); const updates = [];
  const value = "Legacy paragraph.\n\nSecond paragraph.";
  const render = disabled => React.createElement(Component, { value, invalid: false, disabled, onChange: next => updates.push(next) });
  try {
    await React.act(async () => { root.render(render(false)); });
    assert.equal(host.querySelector('[name="content"]').value, value);
    assert.ok(host.querySelector('[contenteditable="true"]'));
    await React.act(async () => { root.render(render(true)); });
    assert.ok(host.querySelector('[contenteditable="false"]'));
    assert.equal(updates.length, 0);
    await React.act(async () => { root.render(render(false)); });
    assert.equal(updates.length, 0);
  } finally { await React.act(async () => root.unmount()); host.remove(); }
});

test("justification survives saving and reopening and can be toggled off", () => {
  const instance = editor("<p>A paragraph to justify.</p><h2>A heading</h2>");
  try {
    instance.commands.selectAll();
    instance.commands.toggleTextAlign("justify");
    const stored = rich.serializeRichContent(instance.getJSON());
    const doc = rich.parseRichContent(stored);
    assert.ok(doc.content.every(node => node.attrs.textAlign === "justify"));
    const reopened = editor(rich.editorDocument(stored));
    try {
      assert.equal(rich.serializeRichContent(reopened.getJSON()), stored);
      reopened.commands.selectAll();
      reopened.commands.toggleTextAlign("justify");
      assert.ok(rich.parseRichContent(rich.serializeRichContent(reopened.getJSON())).content.every(node => !node.attrs?.textAlign));
    } finally { reopened.destroy(); }
  } finally { instance.destroy(); }
});
test("alignment validation strips arbitrary CSS and unsupported alignment values", () => {
  for (const textAlign of ["justify; color:red", "center", {}, "url(javascript:evil())"]) {
    const doc = rich.sanitizeRichDocument({ type: "doc", content: [{ ...paragraph("Safe"), attrs: { textAlign, style: "color:red" } }] });
    assert.equal(doc.content[0].attrs, undefined);
  }
});

test("multipart form line endings retain rich text and pass the same validation", async () => {
  const stored = rich.serializeRichContent({ type: "doc", content: [{ ...paragraph("Published text"), attrs: { textAlign: "justify" } }] });
  const form = new FormData(); form.set("content", stored);
  const submitted = await new Request("https://example.org", { method: "POST", body: form }).formData();
  const transported = submitted.get("content");
  assert.ok(transported.startsWith("RAZAQ-RICH-TEXT/1\r\n"));
  assert.equal(rich.validateStoredContent(transported), stored);
  assert.equal(rich.editorDocument(transported).content[0].attrs.textAlign, "justify");
  assert.throws(() => rich.validateStoredContent("RAZAQ-RICH-TEXT/1\r\n{broken"));
  assert.throws(() => rich.validateStoredContent("RAZAQ-RICH-TEXT/1\r\n" + JSON.stringify({ type: "doc", content: [{ type: "script" }] })));
});
