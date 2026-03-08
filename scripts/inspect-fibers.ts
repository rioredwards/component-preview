/**
 * Standalone fiber inspector, mirrors the extension's React render path so
 * you can test it directly from Node.js without the EDH cycle.
 *
 * Usage:
 *   npm run inspect-fibers -- [line]
 *   npm run inspect-fibers -- --line 21 --file /path/to/App.jsx --url http://localhost:5173
 *
 * Examples:
 *   npm run inspect-fibers -- --help
 *   npm run inspect-fibers -- 19
 *   npm run inspect-fibers -- --line 21
 *
 * What it does:
 *   1. Applies the same jsxDEV route intercept as devServerRenderer.ts
 *   2. Navigates to the dev server and waits for React to render
 *   3. Walks the fiber tree and shows each fiber's data-src-line (Babel source line)
 *   4. Runs the same scoring algorithm as the extension
 *   5. Reports which element would be selected and screenshots it
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { chromium } from "playwright";
import { scoreFiber } from "../src/fiberScoring";
import { JSX_DEV_RUNTIME_PATCH } from "../src/jsxDevPatch";
import { MAX_BYTES, QUALITY_STEPS } from "../src/screenshotConstants";

const DEFAULT_DEV_SERVER = "http://localhost:5173";
const DEFAULT_TARGET_FILE = path.join(process.cwd(), "src/App.jsx");
const DEFAULT_TARGET_LINE = 11;

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

interface CliOptions {
  targetLine: number;
  targetFile: string;
  devServer: string;
}

interface CliParseResult {
  showHelp: boolean;
  options?: CliOptions;
  error?: string;
}

function usageText(): string {
  return [
    "inspect-fibers",
    "",
    "Usage:",
    "  npm run inspect-fibers -- [line]",
    "  npm run inspect-fibers -- --line <number> [--file <path>] [--url <http://localhost:5173>]",
    "  npm run inspect-fibers -- --help",
    "",
    "Options:",
    "  -h, --help       Show this help text and exit",
    `  --line <number>  Target source line (default: ${DEFAULT_TARGET_LINE})`,
    `  --file <path>    Source file path hint (default: ${DEFAULT_TARGET_FILE})`,
    `  --url <url>      Dev server URL (default: ${DEFAULT_DEV_SERVER})`,
  ].join("\n");
}

function parsePositiveInteger(raw: string): number | null {
  if (!/^\d+$/.test(raw)) {
    return null;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    return null;
  }
  return parsed;
}

function parseDevServerUrl(raw: string): string | null {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return raw;
  } catch {
    return null;
  }
}

function readFlagValue(args: string[], i: number, flag: string): { value?: string; nextIndex: number; error?: string } {
  const inlinePrefix = `${flag}=`;
  const current = args[i];
  if (current.startsWith(inlinePrefix)) {
    const value = current.slice(inlinePrefix.length);
    if (!value) {
      return { nextIndex: i, error: `Missing value for ${flag}` };
    }
    return { value, nextIndex: i };
  }
  if (current === flag) {
    const next = args[i + 1];
    if (!next || next.startsWith("-")) {
      return { nextIndex: i, error: `Missing value for ${flag}` };
    }
    return { value: next, nextIndex: i + 1 };
  }
  return { nextIndex: i, error: `Unknown option: ${current}` };
}

function parseCliArgs(args: string[]): CliParseResult {
  let targetLine = DEFAULT_TARGET_LINE;
  let targetFile = DEFAULT_TARGET_FILE;
  let devServer = DEFAULT_DEV_SERVER;
  let positionalLine: string | null = null;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      return { showHelp: true };
    }

    if (arg === "--line" || arg.startsWith("--line=")) {
      const read = readFlagValue(args, i, "--line");
      if (read.error || !read.value) {
        return { showHelp: false, error: read.error ?? "Invalid --line value" };
      }
      const parsedLine = parsePositiveInteger(read.value);
      if (parsedLine === null) {
        return { showHelp: false, error: `Invalid --line value: ${read.value}` };
      }
      targetLine = parsedLine;
      i = read.nextIndex;
      continue;
    }

    if (arg === "--file" || arg.startsWith("--file=")) {
      const read = readFlagValue(args, i, "--file");
      if (read.error || !read.value) {
        return { showHelp: false, error: read.error ?? "Invalid --file value" };
      }
      targetFile = read.value;
      i = read.nextIndex;
      continue;
    }

    if (arg === "--url" || arg.startsWith("--url=")) {
      const read = readFlagValue(args, i, "--url");
      if (read.error || !read.value) {
        return { showHelp: false, error: read.error ?? "Invalid --url value" };
      }
      const parsedUrl = parseDevServerUrl(read.value);
      if (!parsedUrl) {
        return { showHelp: false, error: `Invalid --url value: ${read.value}` };
      }
      devServer = parsedUrl;
      i = read.nextIndex;
      continue;
    }

    if (arg.startsWith("-")) {
      return { showHelp: false, error: `Unknown option: ${arg}` };
    }

    if (positionalLine !== null) {
      return { showHelp: false, error: `Unexpected extra argument: ${arg}` };
    }
    positionalLine = arg;
  }

  if (positionalLine !== null) {
    const parsedLine = parsePositiveInteger(positionalLine);
    if (parsedLine === null) {
      return { showHelp: false, error: `Invalid line value: ${positionalLine}` };
    }
    targetLine = parsedLine;
  }

  return {
    showHelp: false,
    options: { targetLine, targetFile, devServer },
  };
}

(async () => {
  const parsed = parseCliArgs(process.argv.slice(2));
  if (parsed.showHelp) {
    console.log(usageText());
    process.exit(0);
  }
  if (parsed.error || !parsed.options) {
    console.error(`Error: ${parsed.error ?? "Invalid arguments"}`);
    console.log("");
    console.log(usageText());
    process.exit(1);
  }

  const { targetLine, targetFile, devServer } = parsed.options;
  const basename = path.basename(targetFile);
  console.log(`Target: ${targetFile}:${targetLine}`);
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

  console.log("Navigating to", devServer, "(with jsxDEV intercept active)");
  await page.goto(devServer, { waitUntil: "networkidle" });
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

      // Inline scoreFiber, browser boundary cannot import Node modules.
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
    { basename, targetLine },
  );

  if (result.error) {
    console.error("Error:", result.error);
    await browser.close();
    process.exit(1);
  }

  // Verify Node-side scoreFiber matches browser-side
  for (const c of result.candidates) {
    const nodeScore = scoreFiber(c.srcLine, targetLine);
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
    const lineStr = f.srcLine !== null ? `line=${f.srcLine}` : "line=?";
    const domStr = f.hasDom ? `-> <${f.domTag}>` : "(no DOM)";
    console.log(`${indent}${f.typeName}  ${lineStr}  ${domStr}`);
  }

  // -- Print candidates and winner --
  console.log(`\nCandidates for line ${targetLine}:`);
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

  const outPath = path.join(os.tmpdir(), `inspect-fibers-${targetLine}.jpeg`);
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
    { basename, targetLine },
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
