import DOMPurify from "dompurify";
import { safeLinkHref } from "./rich-content";

/** Keep document structure and basic emphasis, never document-specific CSS. */
export function sanitizePastedHTML(html: string): string {
  const fragment = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["p", "div", "span", "br", "h1", "h2", "h3", "h4", "h5", "h6", "strong", "b", "em", "i", "u", "ul", "ol", "li", "blockquote", "a", "hr"],
    ALLOWED_ATTR: ["href", "start", "style"],
    RETURN_DOM_FRAGMENT: true,
  });
  for (const element of Array.from(fragment.querySelectorAll<HTMLElement>("*"))) {
    // Word and Google Docs often express emphasis as inline CSS.
    const style = element.style;
    if (["B", "STRONG"].includes(element.tagName) && ["normal", "400"].includes(style.fontWeight)) {
      element.replaceWith(...Array.from(element.childNodes));
      continue;
    }
    const tags = [];
    if (style.fontWeight === "bold" || Number(style.fontWeight) >= 600) tags.push("strong");
    if (style.fontStyle === "italic") tags.push("em");
    if (style.textDecoration.includes("underline") || style.textDecorationLine.includes("underline")) tags.push("u");
    element.removeAttribute("style");
    for (const tag of tags) {
      const wrapper = document.createElement(tag);
      while (element.firstChild) wrapper.appendChild(element.firstChild);
      element.appendChild(wrapper);
    }
    if (["H4", "H5", "H6"].includes(element.tagName)) {
      const heading = document.createElement("h3");
      heading.append(...Array.from(element.childNodes));
      element.replaceWith(heading);
    }
    if (element.tagName === "A" && !safeLinkHref(element.getAttribute("href"))) element.removeAttribute("href");
  }
  const container = document.createElement("div");
  container.appendChild(fragment);
  return DOMPurify.sanitize(container.innerHTML, {
    ALLOWED_TAGS: ["p", "div", "span", "br", "h1", "h2", "h3", "strong", "b", "em", "i", "u", "ul", "ol", "li", "blockquote", "a", "hr"],
    ALLOWED_ATTR: ["href", "start"],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
  });
}
