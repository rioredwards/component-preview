import { parse as parseSvelte } from "svelte/compiler";
import { createLineStarts, injectPreviewAttributes, offsetToLineColumn } from "./injection.js";
import { TagInjectionPoint, TransformResult } from "./types.js";

type SvelteNode = {
  type?: string;
  start?: number;
  name?: string;
  [key: string]: unknown;
};

function walk(node: unknown, visit: (node: SvelteNode) => void): void {
  if (!node || typeof node !== "object") {
    return;
  }

  const current = node as SvelteNode;
  visit(current);

  for (const value of Object.values(node as Record<string, unknown>)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        walk(item, visit);
      }
      continue;
    }
    walk(value, visit);
  }
}

function isInjectableSvelteNode(node: SvelteNode, source: string): boolean {
  if (typeof node.start !== "number" || node.start < 0 || node.start >= source.length) {
    return false;
  }

  if (source[node.start] !== "<") {
    return false;
  }

  const type = node.type ?? "";
  const allowedTypes = new Set([
    "Element",
    "InlineComponent",
    "Slot",
    "Component",
    "SvelteElement",
  ]);

  if (!allowedTypes.has(type)) {
    return false;
  }

  if (typeof node.name === "string" && node.name.startsWith("svelte:")) {
    return false;
  }

  return true;
}

export function transformSvelte(
  code: string,
  sourceId: string,
  normalizedFilePath: string,
): TransformResult | null {
  const ast = parseSvelte(code);
  const lineStarts = createLineStarts(code);
  const points: TagInjectionPoint[] = [];

  walk((ast as { html?: unknown }).html, (node) => {
    if (!isInjectableSvelteNode(node, code) || typeof node.start !== "number") {
      return;
    }

    const pos = offsetToLineColumn(node.start, lineStarts);
    points.push({
      startOffset: node.start,
      line: pos.line,
      column: pos.column,
      loc: node.start,
    });
  });

  return injectPreviewAttributes(code, sourceId, normalizedFilePath, points);
}
