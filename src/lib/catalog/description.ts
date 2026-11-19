import sanitizeHtml from "sanitize-html";

/**
 * A product description as written in Shopify's editor, cleaned for the product page: headings,
 * paragraphs, lists, bold/italic and links only. Classes, inline styles, spans pasted from other
 * apps, scripts and empty paragraphs (`<p><br></p>`) go; the page styles what is left.
 *
 * Headings move down a level (the page's own title is the only h1, and its sections use h2), so a
 * description's "h2" becomes an h3.
 */
export function cleanDescriptionHtml(html: string): string {
  if (!html.trim()) return "";
  const clean = sanitizeHtml(html, {
    allowedTags: ["h1", "h2", "h3", "h4", "h5", "h6", "p", "ul", "ol", "li", "strong", "b", "em", "i", "br", "a", "blockquote"],
    allowedAttributes: { a: ["href", "rel", "target"] },
    allowedSchemes: ["https", "mailto"],
    allowProtocolRelative: false,
    transformTags: {
      h1: "h3",
      h2: "h3",
      h3: "h4",
      h4: "h4",
      h5: "h4",
      h6: "h4",
      b: "strong",
      i: "em",
      a: (tagName, attribs) => ({ tagName, attribs: { ...attribs, rel: "noopener noreferrer", target: "_blank" } }),
    },
    // Text-free blocks (an empty heading, a paragraph holding only <br>) would only add gaps.
    exclusiveFilter: (frame) => ["p", "h3", "h4", "li", "strong", "em"].includes(frame.tag) && !frame.text.trim(),
  });
  return clean
    .replace(/(<br\s*\/?>\s*)+(<\/(p|li|h3|h4)>)/g, "$2")
    .replace(/(<(p|li|h3|h4)>)\s*(<br\s*\/?>\s*)+/g, "$1")
    .trim();
}
