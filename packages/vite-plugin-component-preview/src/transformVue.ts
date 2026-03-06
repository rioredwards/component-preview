import { NodeTypes, parse as parseTemplate } from "@vue/compiler-dom";
import { parse as parseSfc } from "@vue/compiler-sfc";
import { createLineStarts, injectPreviewAttributes, offsetToLineColumn } from "./injection.js";
import { TagInjectionPoint, TransformResult } from "./types.js";

type VueAstNode = {
  type?: number;
  tag?: string;
  loc?: { start?: { offset?: number } };
  [key: string]: unknown;
};

function walk(node: unknown, visit: (node: VueAstNode) => void): void {
  if (!node || typeof node !== "object") {
    return;
  }

  const current = node as VueAstNode;
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

function shouldInjectVueTag(tag: string): boolean {
  const lower = tag.toLowerCase();
  return lower !== "script" && lower !== "style" && lower !== "template";
}

export function transformVue(
  code: string,
  sourceId: string,
  normalizedFilePath: string,
): TransformResult | null {
  const parsed = parseSfc(code, { filename: sourceId });
  const template = parsed.descriptor.template;
  if (!template) {
    return null;
  }

  const templateStart = template.loc.start.offset;
  const contentRelativeStart = template.loc.source.indexOf(template.content);
  if (contentRelativeStart < 0) {
    return null;
  }
  const contentStart = templateStart + contentRelativeStart;

  const templateAst = parseTemplate(template.content, { comments: false });
  const lineStarts = createLineStarts(code);
  const points: TagInjectionPoint[] = [];

  walk(templateAst, (node) => {
    if (node.type !== NodeTypes.ELEMENT) {
      return;
    }

    if (!node.tag || !shouldInjectVueTag(node.tag)) {
      return;
    }

    const relOffset = node.loc?.start?.offset;
    if (typeof relOffset !== "number") {
      return;
    }

    const startOffset = contentStart + relOffset;
    const pos = offsetToLineColumn(startOffset, lineStarts);

    points.push({
      startOffset,
      line: pos.line,
      column: pos.column,
      loc: startOffset,
    });
  });

  return injectPreviewAttributes(code, sourceId, normalizedFilePath, points);
}
