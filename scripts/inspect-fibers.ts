/**
 * Standalone fiber inspector — mirrors the extension's React render path so
 * you can test it directly from Node.js without the EDH cycle.
 *
 * Usage:
 *   pnpm run inspect-fibers [line]
 *
 * Examples:
 *   pnpm run inspect-fibers          # uses TARGET_LINE below
 *   pnpm run inspect-fibers 19       # test line 19
 *   pnpm run inspect-fibers 21       # test line 21
 *
 * What it does:
 *   1. Applies the same jsxDEV route intercept as devServerRenderer.ts
 *   2. Navigates to DEV_SERVER and waits for React to render
 *   3. Walks the fiber tree and shows each fiber's data-src-line (Babel source line)
 *   4. Runs the same scoring algorithm as the extension
 *   5. Reports which element would be selected and screenshots it
 */

import * as fs from "fs";
import * as path from "path";
import { chromium } from "playwright";
import { scoreFiber } from "../src/fiberScoring";
import { JSX_DEV_RUNTIME_PATCH } from "../src/jsxDevPatch";
import { MAX_BYTES, QUALITY_STEPS } from "../src/screenshotConstants";

const DEV_SERVER = "http://localhost:5173";
const TARGET_FILE = "/home/node/react-app/src/App.jsx";
const TARGET_LINE = parseInt(process.argv[2] ?? "11", 10);

interface FiberDumpEntry {
  depth: number;
  typeName: string;
  srcLine: number | null;
  hasDom: boolean;
  domTag: string | null;
}

interface Candidate {
  srcLine: number;
  domTag: string;
  score: number;
  w: number;
  h: number;
}

interface ScanResult {
  dump: FiberDumpEntry[];
  candidates: Candidate[];
  winner: Candidate | null;
  error?: string;
}

(async () => {
  const basename = path.basename(TARGET_FILE);
  console.log(`Target: ${TARGET_FILE}:${TARGET_LINE}`);
  console.log(`Basename: ${basename}\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Apply the same route intercept as devServerRenderer.ts
  await page.route("**/react_jsx-dev-runtime.js*", async (route) => {
    const response = await route.fetch();
    const original = await response.text();
    const headers = Object.fromEntries(
      Object.entries(response.headers()).filter(([k]) => k !== "content-length"),
    );
    await route.fulfill({ body: original + JSX_DEV_RUNTIME_PATCH, headers });
  });

  console.log("Navigating to", DEV_SERVER, "(with jsxDEV intercept active)");
  await page.goto(DEV_SERVER, { waitUntil: "networkidle" });
  console.log("Page loaded:", page.url());

  await page.waitForFunction(
    () => {
      const root = document.getElementById("root") ?? document.body;
      const key = Object.keys(root).find((k) => k.startsWith("__reactContainer"));
      if (!key) {
        return false;
      }
      const stale = (root as any)[key];
      return !!stale?.stateNode?.current?.child;
    },
    { timeout: 10000 },
  );
  console.log("Fiber tree populated\n");

  // -- Run the exact same logic as devServerRenderer.ts --
  const result: ScanResult = await page.evaluate(
    ({ basename, targetLine }: { basename: string; targetLine: number }) => {
      const rootEl = document.getElementById("root") ?? document.body;
      const key = Object.keys(rootEl).find((k) => k.startsWith("__reactContainer"));
      if (!key) {
        return { dump: [], candidates: [], winner: null, error: "no __reactContainer key" };
      }
      const stale: any = (rootEl as any)[key];
      const hostRoot = stale?.stateNode?.current ?? stale;

      function getDomElement(fiber: any): Element | null {
        for (let f = fiber; f; f = f.child) {
          if (f.stateNode instanceof Element) {
            return f.stateNode;
          }
        }
        return null;
      }

      function extractDebugLine(fiber: any): number | null {
        const srcLine =
          fiber.memoizedProps?.["data-src-line"] ?? fiber.pendingProps?.["data-src-line"];
        if (srcLine !== null && srcLine !== undefined) {
          return Number(srcLine);
        }
        const src = fiber._debugSource;
        if (src?.fileName?.includes(basename)) {
          return src.lineNumber;
        }
        const stack: string = fiber._debugStack?.stack ?? "";
        if (!stack.includes(basename)) {
          return null;
        }
        const after = stack.slice(stack.indexOf(basename) + basename.length);
        const m = after.match(/:(\d+):/);
        return m ? parseInt(m[1]) : null;
      }

      // Inline scoreFiber (browser boundary — can't import Node modules)
      function scoreFiber(candidateLine: number): number {
        if (candidateLine === targetLine) {
          return 0;
        }
        if (candidateLine < targetLine) {
          return -(targetLine - candidateLine);
        }
        return -(candidateLine - targetLine) * 3;
      }

      const candidates: Array<{
        srcLine: number;
        domTag: string;
        score: number;
        w: number;
        h: number;
      }> = [];
      const dump: Array<{
        depth: number;
        typeName: string;
        srcLine: number | null;
        hasDom: boolean;
        domTag: string | null;
      }> = [];

      function walk(fiber: any, depth: number): void {
        if (!fiber || dump.length > 60) {
          return;
        }
        const typeName =
          typeof fiber.type === "function" ? fiber.type.name || "(anon)" : String(fiber.type);
        const srcLine = extractDebugLine(fiber);
        const el = getDomElement(fiber);
        const hasDom = !!el;
        const domTag = el ? el.tagName.toLowerCase() : null;

        dump.push({ depth, typeName, srcLine, hasDom, domTag });

        if (srcLine !== null && hasDom) {
          const rect = el!.getBoundingClientRect();
          candidates.push({
            srcLine,
            domTag: domTag!,
            score: scoreFiber(srcLine),
            w: Math.round(rect.width),
            h: Math.round(rect.height),
          });
        }

        walk(fiber.child, depth + 1);
        walk(fiber.sibling, depth);
      }
      walk(hostRoot, 0);

      candidates.sort((a, b) => b.score - a.score);

      let winner = null;
      for (const c of candidates) {
        if (c.w > 2 && c.h > 2) {
          winner = c;
          break;
        }
      }
      if (!winner) {
        winner = candidates[0] ?? null;
      }

      return { dump, candidates, winner };
    },
    { basename, targetLine: TARGET_LINE },
  );

  if (result.error) {
    console.error("Error:", result.error);
    await browser.close();
    process.exit(1);
  }

  // Verify Node-side scoreFiber matches browser-side
  for (const c of result.candidates) {
    const nodeScore = scoreFiber(c.srcLine, TARGET_LINE);
    if (nodeScore !== c.score) {
      console.warn(
        `SCORE MISMATCH: browser=${c.score} node=${nodeScore} for line=${c.srcLine}`,
      );
    }
  }

  // -- Print fiber dump --
  console.log("Fiber tree (data-src-line values):");
  for (const f of result.dump) {
    const indent = "  ".repeat(f.depth);
    const lineStr = f.srcLine != null ? `line=${f.srcLine}` : "line=?";
    const domStr = f.hasDom ? `-> <${f.domTag}>` : "(no DOM)";
    console.log(`${indent}${f.typeName}  ${lineStr}  ${domStr}`);
  }

  // -- Print candidates and winner --
  console.log(`\nCandidates for line ${TARGET_LINE}:`);
  for (const c of result.candidates) {
    const marker = c === result.winner ? " <- SELECTED" : "";
    console.log(`  <${c.domTag}>  line=${c.srcLine}  score=${c.score}${marker}`);
  }

  if (!result.winner) {
    console.log("\nNo element found - extension would return null");
    await browser.close();
    process.exit(1);
  }

  // -- Screenshot the selected element (same as extension) --
  console.log(`\n-> Screenshotting <${result.winner.domTag}> (line=${result.winner.srcLine})`);

  const outPath = `/tmp/inspect-fibers-${TARGET_LINE}.jpeg`;
  const elementHandle = await page.evaluateHandle(
    ({ basename, targetLine }: { basename: string; targetLine: number }) => {
      const rootEl = document.getElementById("root") ?? document.body;
      const key = Object.keys(rootEl).find((k) => k.startsWith("__reactContainer"));
      const stale: any = (rootEl as any)[key];
      const hostRoot = stale?.stateNode?.current ?? stale;

      function getDomElement(fiber: any): Element | null {
        for (let f = fiber; f; f = f.child) {
          if (f.stateNode instanceof Element) {
            return f.stateNode;
          }
        }
        return null;
      }
      function extractDebugLine(fiber: any): number | null {
        const srcLine =
          fiber.memoizedProps?.["data-src-line"] ?? fiber.pendingProps?.["data-src-line"];
        if (srcLine !== null && srcLine !== undefined) {
          return Number(srcLine);
        }
        const src = fiber._debugSource;
        if (src?.fileName?.includes(basename)) {
          return src.lineNumber;
        }
        const stack: string = fiber._debugStack?.stack ?? "";
        if (!stack.includes(basename)) {
          return null;
        }
        const after = stack.slice(stack.indexOf(basename) + basename.length);
        const m = after.match(/:(\d+):/);
        return m ? parseInt(m[1]) : null;
      }
      function scoreFiber(line: number): number {
        if (line === targetLine) {
          return 0;
        }
        if (line < targetLine) {
          return -(targetLine - line);
        }
        return -(line - targetLine) * 3;
      }

      const candidates: Array<{ element: Element; line: number }> = [];
      function walk(fiber: any): void {
        if (!fiber) {
          return;
        }
        const line = extractDebugLine(fiber);
        if (line !== null) {
          const el = getDomElement(fiber);
          if (el) {
            candidates.push({ element: el, line });
          }
        }
        walk(fiber.child);
        walk(fiber.sibling);
      }
      walk(hostRoot);
      candidates.sort((a, b) => scoreFiber(b.line) - scoreFiber(a.line));
      for (const c of candidates) {
        const r = c.element.getBoundingClientRect();
        if (r.width > 2 && r.height > 2) {
          return c.element;
        }
      }
      return candidates[0]?.element ?? null;
    },
    { basename, targetLine: TARGET_LINE },
  );

  const el = elementHandle.asElement();
  if (!el) {
    console.log("evaluateHandle returned null");
    await browser.close();
    process.exit(1);
  }

  const box = await el.boundingBox();
  let buf: Buffer = Buffer.alloc(0);
  for (const quality of QUALITY_STEPS) {
    buf = await el.screenshot({ type: "jpeg", quality, animations: "disabled" });
    console.log(
      `  quality=${quality} -> ${buf.length} bytes${buf.length <= MAX_BYTES ? " fits" : " too large"}`,
    );
    if (buf.length <= MAX_BYTES) {
      break;
    }
  }

  // Resize fallback for oversized elements
  if (buf.length > MAX_BYTES) {
    console.log("  -> resizing oversized screenshot...");
    const resizePage = await browser.newPage({ viewport: { width: 820, height: 620 } });
    const b64 = buf.toString("base64");
    await resizePage.setContent(
      '<!DOCTYPE html><html><body style="margin:0;padding:0;overflow:hidden">' +
        '<img src="data:image/jpeg;base64,' +
        b64 +
        '" style="max-width:800px;max-height:600px;display:block;object-fit:contain">' +
        "</body></html>",
    );
    const img = resizePage.locator("img");
    await img.waitFor({ state: "visible", timeout: 5000 });
    buf = await img.screenshot({ type: "jpeg", quality: QUALITY_STEPS[0], animations: "disabled" });
    await resizePage.close();
    console.log(`  resized -> ${buf.length} bytes`);
  }

  fs.writeFileSync(outPath, buf);
  console.log(`Screenshot saved: ${outPath}`);
  console.log(
    `  size=${buf.length} bytes  box=${JSON.stringify({ w: Math.round(box?.width ?? 0), h: Math.round(box?.height ?? 0) })}${buf.length <= MAX_BYTES ? "" : " WARNING: still over limit"}`,
  );

  await browser.close();
})();
