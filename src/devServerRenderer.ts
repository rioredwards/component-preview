import * as fs from "fs/promises";
import { Page } from "playwright";
import { log } from "./logger";
import { getContext } from "./renderer";

const MAX_BYTES = 67_500;
const QUALITY_STEPS = [85, 70, 55, 40];

export interface DevServerRenderOptions {
  devServerUrl: string;
  filePath: string;
  line: number; // 1-based
  outputPath: string;
}

// Persistent page — navigated once, reused for all subsequent fiber scans.
let devPage: Page | null = null;
let devPageUrl: string | null = null;

// Patch appended to the Vite-pre-bundled react-jsx-dev-runtime.js.
//
// Background: React 19 drops the `source` argument that Babel's JSX transform
// passes to jsxDEV (5th param: { fileName, lineNumber, columnNumber }). Instead
// it stores `_debugStack = new Error()` whose `.stack` contains *compiled* line
// numbers that don't match the original source file.
//
// Fix: wrap jsxDEV and copy the Babel-computed lineNumber into a `data-src-line`
// prop on host (string-type) elements. React passes `data-*` attributes through
// to the DOM without warnings. The prop also lands on fiber.memoizedProps where
// our evaluate code can read it — giving exact source line numbers.
//
// The module uses var-scoped `require_jsx_dev_runtime` (esbuild __commonJS
// pattern), so this IIFE can call it to get the cached exports object and
// re-assign jsxDEV before App.jsx's import binding is resolved.
const JSX_DEV_RUNTIME_PATCH = `
;(function () {
  if (typeof require_jsx_dev_runtime === "undefined") { return; }
  var mod = require_jsx_dev_runtime();
  if (!mod || typeof mod.jsxDEV !== "function") { return; }
  var orig = mod.jsxDEV;
  mod.jsxDEV = function (type, config, key, isStatic, source, self) {
    if (source && typeof type === "string" && source.lineNumber != null) {
      config = Object.assign({}, config, { "data-src-line": source.lineNumber });
    }
    return orig(type, config, key, isStatic, source, self);
  };
})();
`;

async function getDevPage(devServerUrl: string): Promise<Page> {
  if (devPage && devPageUrl === devServerUrl) {
    log("getDevPage: reusing existing page");
    return devPage;
  }

  log("getDevPage: navigating to", devServerUrl);
  const ctx = await getContext();
  if (devPage) {
    await devPage.close().catch(() => undefined);
  }

  devPage = await ctx.newPage();

  // Intercept the pre-bundled React JSX dev runtime to inject our jsxDEV patch.
  // Must be registered before goto() so the route is active for the first load.
  await devPage.route("**/react_jsx-dev-runtime.js*", async (route) => {
    const response = await route.fetch();
    const original = await response.text();
    // Strip content-length — body length will change after appending the patch.
    const headers = Object.fromEntries(
      Object.entries(response.headers()).filter(([k]) => k !== "content-length"),
    );
    await route.fulfill({ body: original + JSX_DEV_RUNTIME_PATCH, headers });
  });

  await devPage.goto(devServerUrl, { waitUntil: "networkidle" });
  log("getDevPage: page loaded, url =", devPage.url());

  // __reactContainer$<key> is set once at createRoot() time and always points
  // to the *initial* (stale) HostRoot fiber. After the first render React swaps
  // FiberRootNode.current to the newly committed tree, so we must follow
  // stale → stateNode (FiberRootNode) → current (live HostRoot) → child.
  await devPage.waitForFunction(
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
  log("getDevPage: fiber tree is populated");

  devPageUrl = devServerUrl;
  return devPage;
}

export function disposeDevPage(): void {
  devPage?.close().catch(() => undefined);
  devPage = null;
  devPageUrl = null;
}

/**
 * Runs the fiber scan on the persistent dev server page and screenshots
 * the element best matching the hovered source location.
 */
export async function renderFromDevServer(opts: DevServerRenderOptions): Promise<void> {
  const page = await getDevPage(opts.devServerUrl);
  const basename = opts.filePath.split("/").pop()!;

  log("renderFromDevServer: scanning for", basename, "line", opts.line);

  const handle = await page.evaluateHandle(
    ({ basename, targetLine }: { basename: string; targetLine: number }) => {
      // Get the live HostRoot fiber. The __reactContainer$ property is set once
      // at createRoot() and always holds the stale initial fiber; the live
      // committed tree is at stale.stateNode.current.
      const rootEl = document.getElementById("root") ?? document.body;
      const key = Object.keys(rootEl).find((k) => k.startsWith("__reactContainer"));
      if (!key) {
        return null;
      }
      const stale: any = (rootEl as any)[key];
      const hostRoot = stale?.stateNode?.current ?? stale;

      // Walk down via .child until we hit a real DOM element.
      function getDomElement(fiber: any): Element | null {
        for (let f = fiber; f; f = f.child) {
          if (f.stateNode instanceof Element) {
            return f.stateNode;
          }
        }
        return null;
      }

      // Extract the source line number from a fiber's debug metadata.
      //
      // Priority:
      //  1. data-src-line  — set by our jsxDEV patch, exact Babel source lines
      //  2. _debugSource   — React 18 (babel-plugin-react-jsx-source)
      //  3. _debugStack    — React 19 fallback (compiled lines, imprecise)
      function extractDebugLine(fiber: any): number | null {
        // 1. Best: our injected data-src-line (exact source lines from Babel)
        const srcLine =
          fiber.memoizedProps?.["data-src-line"] ?? fiber.pendingProps?.["data-src-line"];
        if (srcLine !== null && srcLine !== undefined) {
          return Number(srcLine);
        }

        // 2. React 18: _debugSource set by babel-plugin-react-jsx-source
        const src = fiber._debugSource;
        if (src?.fileName?.includes(basename)) {
          return src.lineNumber as number;
        }

        // 3. React 19 fallback: _debugStack Error — contains compiled line numbers.
        // After "App.jsx" there may be "?t=123456" (Vite HMR timestamp) before
        // ":line:col". /:(\d+):/ finds the first :NUMBER: regardless of query params.
        const stack: string = fiber._debugStack?.stack ?? "";
        if (!stack.includes(basename)) {
          return null;
        }
        const after = stack.slice(stack.indexOf(basename) + basename.length);
        const m = after.match(/:(\d+):/);
        return m ? parseInt(m[1]) : null;
      }

      // Collect every fiber that references this file and has a visible DOM node.
      const candidates: Array<{ element: Element; line: number }> = [];

      function collect(fiber: any): void {
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
        collect(fiber.child);
        collect(fiber.sibling);
      }
      collect(hostRoot);

      if (candidates.length === 0) {
        return null;
      }

      // Score candidates by proximity to targetLine. Exact match wins; lines
      // just before the cursor are plausibly "open" containers (small penalty);
      // lines after haven't opened yet (heavy penalty).
      function scoreFiber(candidateLine: number): number {
        if (candidateLine === targetLine) {
          return 0;
        }
        if (candidateLine < targetLine) {
          return -(targetLine - candidateLine);
        }
        return -(candidateLine - targetLine) * 3;
      }

      candidates.sort((a, b) => scoreFiber(b.line) - scoreFiber(a.line));
      return candidates[0].element;
    },
    { basename, targetLine: opts.line },
  );

  const elementHandle = handle.asElement();
  if (elementHandle) {
    const info = await elementHandle.evaluate((el) => ({
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      cls: (el.className as string).slice(0, 50) || null,
      text: el.textContent?.trim().slice(0, 60) || null,
      box: el.getBoundingClientRect(),
    }));
    log("renderFromDevServer: matched", JSON.stringify(info));
  }

  if (!elementHandle) {
    // Run a diagnostic pass to log which fibers were found for this file.
    const found = await page.evaluate(
      ({ basename }: { basename: string }) => {
        const rootEl = document.getElementById("root") ?? document.body;
        const key = Object.keys(rootEl).find((k) => k.startsWith("__reactContainer"));
        if (!key) {
          return ["no __reactContainer key found"];
        }
        const stale: any = (rootEl as any)[key];
        const hostRoot = stale?.stateNode?.current ?? stale;

        const out: string[] = [];
        function walk(f: any): void {
          if (!f || out.length >= 15) {
            return;
          }
          const srcLine =
            f.memoizedProps?.["data-src-line"] ?? f.pendingProps?.["data-src-line"];
          const src = f._debugSource;
          const stack: string = f._debugStack?.stack ?? "";
          if (
            srcLine !== null && srcLine !== undefined ||
            src?.fileName?.includes(basename) ||
            stack.includes(basename)
          ) {
            const line = srcLine ?? src?.lineNumber ?? (() => {
              const after = stack.slice(stack.indexOf(basename) + basename.length);
              const m = after.match(/:(\d+):/);
              return m ? m[1] : "?";
            })();
            const name = typeof f.type === "function" ? f.type.name : String(f.type);
            out.push(`${name} @ line ${line}`);
          }
          walk(f.child);
          walk(f.sibling);
        }
        walk(hostRoot);
        return out.length ? out : ["no fibers matched this file"];
      },
      { basename },
    );
    log("renderFromDevServer: no element found. Fibers for", basename, ":", found);
    throw new Error(
      `No React element found at ${opts.filePath}:${opts.line}\n` +
        `  Fibers in this file: ${found.join(", ")}`,
    );
  }

  let buf: Buffer = Buffer.alloc(0);
  for (const quality of QUALITY_STEPS) {
    buf = await elementHandle.screenshot({ type: "jpeg", quality, animations: "disabled" });
    log(`renderFromDevServer: screenshot quality=${quality} size=${buf.length}`);
    if (buf.length <= MAX_BYTES) {
      break;
    }
  }
  await fs.writeFile(opts.outputPath, buf);
}
