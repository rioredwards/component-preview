import { Browser, BrowserContext, chromium, Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { VitePluginAdapter } from "./vitePluginAdapter";

describe("VitePluginAdapter integration", () => {
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  let adapter: VitePluginAdapter;
  let launchError: Error | null = null;

  beforeAll(async () => {
    adapter = new VitePluginAdapter();
    try {
      browser = await chromium.launch({ headless: true });
      context = await browser.newContext();
      page = await context.newPage();
    } catch (err) {
      launchError = err instanceof Error ? err : new Error(String(err));
    }
  });

  afterAll(async () => {
    await page?.close();
    await context?.close();
    await browser?.close();
  });

  it("detects plugin marker and finds exact file+line+column match", async ({ skip }) => {
    if (launchError || !page) {
      skip(`Playwright unavailable in this environment: ${launchError?.message ?? "unknown error"}`);
    }

    await page.setContent(`
      <html>
        <body>
          <script>window.__COMPONENT_PREVIEW_PLUGIN__ = { version: "0.1.0" };</script>
          <div id="target" data-cp-file="src/App.vue" data-cp-line="12" data-cp-col="5" data-cp-loc="220">x</div>
        </body>
      </html>
    `);

    expect(await adapter.detect(page)).toBe(true);

    const el = await adapter.findElement(page, {
      workspaceRoot: "/repo",
      absoluteFilePath: "/repo/src/App.vue",
      line: 12,
      column: 5,
    });

    expect(el).not.toBeNull();
    const id = await el?.evaluate((node) => node.id);
    expect(id).toBe("target");
  });

  it("falls back to nearest line and column when exact metadata is absent", async ({ skip }) => {
    if (launchError || !page) {
      skip(`Playwright unavailable in this environment: ${launchError?.message ?? "unknown error"}`);
    }

    await page.setContent(`
      <html>
        <body>
          <div id="a" data-cp-file="src/App.vue" data-cp-line="20" data-cp-col="1" data-cp-loc="400">a</div>
          <div id="b" data-cp-file="src/App.vue" data-cp-line="22" data-cp-col="6" data-cp-loc="430">b</div>
          <div id="c" data-cp-file="src/App.vue" data-cp-line="24" data-cp-col="2" data-cp-loc="460">c</div>
        </body>
      </html>
    `);

    const el = await adapter.findElement(page, {
      workspaceRoot: "/repo",
      absoluteFilePath: "/repo/src/App.vue",
      line: 22,
      column: 4,
    });

    expect(el).not.toBeNull();
    const id = await el?.evaluate((node) => node.id);
    expect(id).toBe("b");
  });

  it("distinguishes same basename files by full relative path", async ({ skip }) => {
    if (launchError || !page) {
      skip(`Playwright unavailable in this environment: ${launchError?.message ?? "unknown error"}`);
    }

    await page.setContent(`
      <html>
        <body>
          <div id="admin" data-cp-file="src/admin/Button.tsx" data-cp-line="10" data-cp-col="1" data-cp-loc="100">admin</div>
          <div id="site" data-cp-file="src/site/Button.tsx" data-cp-line="10" data-cp-col="1" data-cp-loc="200">site</div>
        </body>
      </html>
    `);

    const admin = await adapter.findElement(page, {
      workspaceRoot: "/repo",
      absoluteFilePath: "/repo/src/admin/Button.tsx",
      line: 10,
      column: 1,
    });
    const site = await adapter.findElement(page, {
      workspaceRoot: "/repo",
      absoluteFilePath: "/repo/src/site/Button.tsx",
      line: 10,
      column: 1,
    });

    expect(await admin?.evaluate((node) => node.id)).toBe("admin");
    expect(await site?.evaluate((node) => node.id)).toBe("site");
  });
});
