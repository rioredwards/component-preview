import { randomUUID } from "crypto";
import { HTMLElement, Node, parse } from "node-html-parser";

export interface AnnotateResult {
  html: string; // HTML with data-hover-id injected
  hoverId: string; // UUID for Playwright locator
  elementId: string; // stable structural identity for cache key
}

const STABLE_ATTRS = ["id", "data-testid", "data-component"] as const;

export function elementIdentityFromNode(element: HTMLElement): string {
  // Priority chain: use an existing stable attribute if present
  for (const attr of STABLE_ATTRS) {
    const val = element.getAttribute(attr)?.trim();
    if (val && !val.includes('"')) {
      return attr === "id" ? `#${val}` : `[${attr}="${val}"]`;
    }
  }

  // Fallback: build a structural path from root to this element
  const segments: string[] = [];
  let current: HTMLElement = element;

  while (current.tagName) {
    const tag = current.tagName.toLowerCase();
    const parent = current.parentNode as HTMLElement | undefined;
    let segment = tag;

    if (parent?.tagName) {
      const siblings = parent.children.filter((c) => c.tagName?.toLowerCase() === tag);
      if (siblings.length > 1) {
        const idx = siblings.indexOf(current) + 1; // 1-based
        segment = `${tag}:nth-of-type(${idx})`;
      }
    }

    segments.unshift(segment);
    current = current.parentNode as HTMLElement;
  }

  return segments.join(" > ");
}

export function findDeepestAtOffset(node: Node, offset: number): HTMLElement | null {
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

export function annotateHtml(htmlText: string, offset: number): AnnotateResult | null {
  const root = parse(htmlText);
  const element = findDeepestAtOffset(root, offset);
  if (!element) {
    return null;
  }

  const elementId = elementIdentityFromNode(element);
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
    } else if (ch === ">") {
      insertAt = i;
      break;
    }
  }

  if (insertAt === -1) {
    return null;
  }

  const html =
    htmlText.slice(0, insertAt) + ` data-hover-id="${hoverId}"` + htmlText.slice(insertAt);

  return { html, hoverId, elementId };
}
