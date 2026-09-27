import { Fragment, type ReactNode } from "react";
import type { PublicArticle } from "@/lib/journal/types";
import { sanitizeRichDocument, safeLinkHref, type RichNode } from "@/lib/journal/rich-content";

function renderNode(node: RichNode, key: number): ReactNode {
  if (node.type === "text") {
    let text: ReactNode = node.text;
    for (const mark of node.marks ?? []) {
      if (mark.type === "bold") text = <strong>{text}</strong>;
      if (mark.type === "italic") text = <em>{text}</em>;
      if (mark.type === "underline") text = <u>{text}</u>;
      if (mark.type === "link") {
        const href = safeLinkHref(mark.attrs?.href);
        if (href) text = <a href={href} rel="noopener noreferrer">{text}</a>;
      }
    }
    return <Fragment key={key}>{text}</Fragment>;
  }
  const children = node.content?.map(renderNode);
  const style = node.attrs?.textAlign ? { textAlign: node.attrs.textAlign } : undefined;
  switch (node.type) {
    case "paragraph": return <p key={key} style={style}>{children?.length ? children : <br />}</p>;
    case "heading": return node.attrs?.level === 1 ? <h1 key={key} style={style}>{children}</h1> : node.attrs?.level === 3 ? <h3 key={key} style={style}>{children}</h3> : <h2 key={key} style={style}>{children}</h2>;
    case "bulletList": return <ul key={key}>{children}</ul>;
    case "orderedList": return <ol key={key} start={node.attrs?.start}>{children}</ol>;
    case "listItem": return <li key={key}>{children}</li>;
    case "blockquote": return <blockquote key={key}>{children}</blockquote>;
    case "horizontalRule": return <hr key={key} />;
    case "hardBreak": return <br key={key} />;
    default: return null;
  }
}
export default function ArticleContent({ article }: { article: Pick<PublicArticle, "content" | "richContent"> }) {
  if (article.richContent) {
    const document = sanitizeRichDocument(article.richContent);
    return <div className="article-prose rich-content">{document.content.map(renderNode)}</div>;
  }
  return <div className="article-prose">{article.content.map((block, index) => block.type === "heading" ? <h2 key={index}>{block.text}</h2> : block.type === "quote" ? <blockquote key={index}><p>{block.text}</p></blockquote> : <p key={index} style={{ whiteSpace: "pre-wrap" }}>{block.text}</p>)}</div>;
}
