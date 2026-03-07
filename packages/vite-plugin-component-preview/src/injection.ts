import MagicString from "magic-string";
import { TagInjectionPoint, TransformResult } from "./types.js";

export function createLineStarts(source: string): number[] {
  const starts = [0];
  for (let i = 0; i < source.length; i += 1) {
    if (source.charCodeAt(i) === 10) {
      starts.push(i + 1);
    }
  }
  return starts;
}

export function offsetToLineColumn(offset: number, lineStarts: number[]): { line: number; column: number } {
  let low = 0;
  let high = lineStarts.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const start = lineStarts[mid];
    const next = mid + 1 < lineStarts.length ? lineStarts[mid + 1] : Number.MAX_SAFE_INTEGER;
    if (offset < start) {
      high = mid - 1;
    } else if (offset >= next) {
      low = mid + 1;
    } else {
      return { line: mid + 1, column: offset - start + 1 };
    }
  }

  return { line: 1, column: 1 };
}

export function findTagCloseOffset(source: string, startOffset: number): number {
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  let braceDepth = 0;

  for (let i = startOffset; i < source.length; i += 1) {
    const ch = source[i];
    const prev = i > 0 ? source[i - 1] : "";

    if (ch === "'" && !inDouble && !inBacktick && braceDepth === 0 && prev !== "\\") {
      inSingle = !inSingle;
      continue;
    }

    if (ch === "\"" && !inSingle && !inBacktick && braceDepth === 0 && prev !== "\\") {
      inDouble = !inDouble;
      continue;
    }

    if (ch === "`" && !inSingle && !inDouble && prev !== "\\") {
      inBacktick = !inBacktick;
      continue;
    }

    if (inSingle || inDouble || inBacktick) {
      continue;
    }

    if (ch === "{") {
      braceDepth += 1;
      continue;
    }

    if (ch === "}" && braceDepth > 0) {
      braceDepth -= 1;
      continue;
    }

    if (ch === ">" && braceDepth === 0) {
      return i;
    }
  }

  return -1;
}

function buildAttributeString(
  normalizedFilePath: string,
  line: number,
  column: number,
  loc: number,
): string {
  return ` data-cp-file="${normalizedFilePath}" data-cp-line="${line}" data-cp-col="${column}" data-cp-loc="${loc}"`;
}

export function injectPreviewAttributes(
  code: string,
  sourceId: string,
  normalizedFilePath: string,
  points: TagInjectionPoint[],
): TransformResult | null {
  if (points.length === 0) {
    return null;
  }

  const s = new MagicString(code);
  let modified = false;

  const ordered = points
    .slice()
    .sort((a, b) => b.startOffset - a.startOffset);

  for (const point of ordered) {
    const close = findTagCloseOffset(code, point.startOffset);
    if (close <= point.startOffset) {
      continue;
    }

    const openTagSource = code.slice(point.startOffset, close + 1);
    if (openTagSource.includes("data-cp-file=")) {
      continue;
    }

    // For self-closing tags (/>), insert before the slash
    const insertPos = close > 0 && code[close - 1] === "/" ? close - 1 : close;

    s.appendLeft(
      insertPos,
      buildAttributeString(normalizedFilePath, point.line, point.column, point.loc),
    );
    modified = true;
  }

  if (!modified) {
    return null;
  }

  return {
    code: s.toString(),
    map: s.generateMap({
      source: sourceId,
      includeContent: true,
      hires: true,
    }),
  };
}
