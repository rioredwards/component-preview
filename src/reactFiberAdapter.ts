import * as path from "path";
import { ElementHandle, Page } from "playwright";
import { FindElementRequest, FrameworkAdapter } from "./frameworkAdapter";
import { JSX_DEV_RUNTIME_PATCH } from "./jsxDevPatch";
import { normalizeForComparison, normalizeWorkspaceRelativePath } from "./pathUtils";

export class ReactFiberAdapter implements FrameworkAdapter {
  readonly name = "react-fiber" as const;

  private readonly initializedPages = new WeakSet<Page>();

  async initialize(page: Page, _devServerUrl: string): Promise<void> {
    if (this.initializedPages.has(page)) {
      return;
    }

    await page.route("**/react_jsx-dev-runtime.js*", async (route) => {
      const response = await route.fetch();
      const original = await response.text();
      const headers = Object.fromEntries(
        Object.entries(response.headers()).filter(([k]) => k !== "content-length"),
      );
      await route.fulfill({ body: original + JSX_DEV_RUNTIME_PATCH, headers });
    });

    this.initializedPages.add(page);
  }

  async detect(page: Page): Promise<boolean> {
    try {
      return await page.evaluate(() => {
        const roots: Array<Element> = [];
        const rootById = document.getElementById("root");
        const appById = document.getElementById("app");
        const nextById = document.getElementById("__next");
        if (rootById) {
          roots.push(rootById);
        }
        if (appById) {
          roots.push(appById);
        }
        if (nextById) {
          roots.push(nextById);
        }
        roots.push(document.body);

        for (const root of roots) {
          const key = Object.keys(root).find((k) => k.startsWith("__reactContainer"));
          if (!key) {
            continue;
          }
          const stale = (root as any)[key];
          if (stale?.stateNode?.current?.child) {
            return true;
          }
          if (stale?.child) {
            return true;
          }
        }
        return false;
      });
    } catch {
      return false;
    }
  }

  async findElement(page: Page, req: FindElementRequest): Promise<ElementHandle<Element> | null> {
    const basename = path.basename(req.absoluteFilePath);
    const relativePath = normalizeWorkspaceRelativePath(req.workspaceRoot, req.absoluteFilePath);
    const relativePathNormalized = normalizeForComparison(relativePath);
    const basenameNormalized = normalizeForComparison(basename);

    const handle = await page.evaluateHandle(
      ({
        targetLine,
        relativePathNormalized,
        basenameNormalized,
      }: {
        targetLine: number;
        relativePathNormalized: string;
        basenameNormalized: string;
      }) => {
        const roots: Array<Element> = [];
        const rootById = document.getElementById("root");
        const appById = document.getElementById("app");
        const nextById = document.getElementById("__next");
        if (rootById) {
          roots.push(rootById);
        }
        if (appById) {
          roots.push(appById);
        }
        if (nextById) {
          roots.push(nextById);
        }
        roots.push(document.body);

        const fileMatches = (input: string): boolean => {
          const normalized = input.replace(/\\/g, "/").toLowerCase();
          return (
            normalized.includes(relativePathNormalized) ||
            normalized.endsWith(`/${relativePathNormalized}`) ||
            normalized.includes(`/${basenameNormalized}`)
          );
        };

        const resolveHostRoot = (): any => {
          for (const rootEl of roots) {
            const key = Object.keys(rootEl).find((k) => k.startsWith("__reactContainer"));
            if (!key) {
              continue;
            }
            const stale = (rootEl as any)[key];
            const hostRoot = stale?.stateNode?.current ?? stale;
            if (hostRoot) {
              return hostRoot;
            }
          }
          return null;
        };

        const hostRoot = resolveHostRoot();
        if (!hostRoot) {
          return null;
        }

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
          const srcFile =
            fiber.memoizedProps?.["data-src-file"] ?? fiber.pendingProps?.["data-src-file"];

          if (srcLine !== null && srcLine !== undefined) {
            if (typeof srcFile === "string" && !fileMatches(srcFile)) {
              return null;
            }
            return Number(srcLine);
          }

          const src = fiber._debugSource;
          if (src?.fileName && fileMatches(String(src.fileName))) {
            return src.lineNumber as number;
          }

          const stack: string = fiber._debugStack?.stack ?? "";
          if (!stack || !fileMatches(stack)) {
            return null;
          }
          const m = stack.match(/:(\d+):\d+\)?(?:\n|$)/);
          return m ? Number.parseInt(m[1], 10) : null;
        }

        function scoreFiber(candidateLine: number): number {
          if (candidateLine === targetLine) {
            return 0;
          }
          if (candidateLine < targetLine) {
            return -(targetLine - candidateLine);
          }
          return -(candidateLine - targetLine) * 3;
        }

        const candidates: Array<{ element: Element; line: number }> = [];
        const stack: any[] = [hostRoot];
        while (stack.length > 0) {
          const fiber = stack.pop();
          if (!fiber) {
            continue;
          }

          const line = extractDebugLine(fiber);
          if (line !== null) {
            const el = getDomElement(fiber);
            if (el) {
              candidates.push({ element: el, line });
            }
          }

          if (fiber.sibling) {
            stack.push(fiber.sibling);
          }
          if (fiber.child) {
            stack.push(fiber.child);
          }
        }

        if (candidates.length === 0) {
          return null;
        }

        candidates.sort((a, b) => scoreFiber(b.line) - scoreFiber(a.line));
        for (const candidate of candidates) {
          const rect = candidate.element.getBoundingClientRect();
          if (rect.width > 2 && rect.height > 2) {
            return candidate.element;
          }
        }

        return candidates[0].element;
      },
      {
        targetLine: req.line,
        relativePathNormalized,
        basenameNormalized,
      },
    );

    return handle.asElement();
  }
}
