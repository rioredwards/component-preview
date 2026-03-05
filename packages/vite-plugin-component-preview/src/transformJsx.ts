import { parse } from "@babel/parser";
import { createLineStarts, injectPreviewAttributes, offsetToLineColumn } from "./injection";
import { TagInjectionPoint, TransformResult } from "./types";

type NodeLike = {
  type?: string;
  start?: number;
  loc?: { start: { line: number; column: number } };
  name?: unknown;
};

function isHostJsxTagName(name: unknown): boolean {
  if (!name || typeof name !== "object") {
    return false;
  }

  const maybe = name as { type?: string; name?: string };
  if (maybe.type !== "JSXIdentifier" || !maybe.name) {
    return false;
  }

  const first = maybe.name[0];
  return first === first.toLowerCase();
}

function walk(node: unknown, visit: (node: NodeLike) => void): void {
  if (!node || typeof node !== "object") {
    return;
  }

  const current = node as NodeLike;
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

export function transformJsx(
  code: string,
  sourceId: string,
  normalizedFilePath: string,
): TransformResult | null {
  const ast = parse(code, {
    sourceType: "module",
    plugins: ["jsx", "typescript"],
  });

  const points: TagInjectionPoint[] = [];
  const lineStarts = createLineStarts(code);

  walk(ast, (node) => {
    if (node.type !== "JSXOpeningElement" || typeof node.start !== "number") {
      return;
    }

    if (!isHostJsxTagName(node.name)) {
      return;
    }

    const pos = node.loc?.start
      ? { line: node.loc.start.line, column: node.loc.start.column + 1 }
      : offsetToLineColumn(node.start, lineStarts);

    points.push({
      startOffset: node.start,
      line: pos.line,
      column: pos.column,
      loc: node.start,
    });
  });

  return injectPreviewAttributes(code, sourceId, normalizedFilePath, points);
}
