import { parse, HTMLElement, Node } from 'node-html-parser';
import { randomUUID } from 'crypto';

function findDeepestAtOffset(node: Node, offset: number): HTMLElement | null {
  if (!(node instanceof HTMLElement)) {
    return null;
  }
  // Skip the root node (tagName is null for the document root)
  if (!node.tagName) {
    let best: HTMLElement | null = null;
    for (const child of node.childNodes) {
      const found = findDeepestAtOffset(child, offset);
      if (found) {
        best = found;
      }
    }
    return best;
  }

  const [start, end] = node.range;
  if (offset < start || offset > end) {
    return null;
  }

  // Check children first for a deeper match
  for (const child of node.childNodes) {
    const found = findDeepestAtOffset(child, offset);
    if (found) {
      return found;
    }
  }

  return node;
}

export function annotateHtml(
  htmlText: string,
  offset: number
): { html: string; hoverId: string } | null {
  const root = parse(htmlText);
  const element = findDeepestAtOffset(root, offset);
  if (!element) {
    return null;
  }

  const hoverId = randomUUID();

  // Find the closing > of the open tag, respecting quoted attribute values
  const tagStart = element.range[0];
  let inQuote: string | null = null;
  let insertAt = -1;

  for (let i = tagStart; i < htmlText.length; i++) {
    const ch = htmlText[i];
    if (inQuote) {
      if (ch === inQuote) {
        inQuote = null;
      }
    } else if (ch === '"' || ch === "'") {
      inQuote = ch;
    } else if (ch === '>') {
      insertAt = i;
      break;
    }
  }

  if (insertAt === -1) {
    return null;
  }

  const html =
    htmlText.slice(0, insertAt) +
    ` data-hover-id="${hoverId}"` +
    htmlText.slice(insertAt);

  return { html, hoverId };
}
