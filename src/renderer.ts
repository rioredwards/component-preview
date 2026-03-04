import { randomUUID } from "crypto";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { Browser, BrowserContext, chromium } from "playwright";
import { captureAdaptiveJpeg, settlePageForCapture } from "./screenshotPipeline";
import { VIEWPORT_HEIGHT, VIEWPORT_WIDTH } from "./screenshotConstants";

export interface RenderOptions {
  html: string;
  hoverId: string;
  outputPath: string;
}

let browserInstance: Browser | null = null;
let browserContext: BrowserContext | null = null;

export async function getContext(): Promise<BrowserContext> {
  if (!browserInstance) {
    browserInstance = await chromium.launch({ headless: true });
  }
  if (!browserContext) {
    browserContext = await browserInstance.newContext({
      viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
    });
  }
  return browserContext;
}

export async function renderElement(opts: RenderOptions): Promise<void> {
  const { html, hoverId, outputPath } = opts;

  const tmpFile = path.join(os.tmpdir(), `hover-${hoverId}.html`);
  await fs.writeFile(tmpFile, html, "utf8");

  const ctx = await getContext();
  const page = await ctx.newPage();
  try {
    await page.goto(`file://${tmpFile}`, { waitUntil: "networkidle" });
    const locator = page.locator(`[data-hover-id="${hoverId}"]`);
    await locator.waitFor({ state: "visible", timeout: 5000 });
    const handle = await locator.elementHandle();
    if (!handle) {
      throw new Error(`Failed to resolve element handle for hover id ${hoverId}`);
    }

    await settlePageForCapture(page);
    const buf = await captureAdaptiveJpeg(handle, page, ctx);
    await fs.writeFile(outputPath, buf);
  } finally {
    await page.close();
    await fs.unlink(tmpFile).catch(() => undefined);
  }
}

/**
 * Compresses an arbitrary image file to a JPEG that is guaranteed to fit
 * within the VS Code MarkdownString base64 limit. Renders the image in a
 * headless page and uses the adaptive quality pipeline.
 */
export async function compressImageFile(inputPath: string, outputPath: string): Promise<void> {
  const html =
    `<!DOCTYPE html><html><body style="margin:0;padding:0">` +
    `<img src="file://${inputPath}" style="max-width:800px;display:block">` +
    `</body></html>`;

  const tmpFile = path.join(os.tmpdir(), `compress-${randomUUID()}.html`);
  await fs.writeFile(tmpFile, html, "utf8");

  const ctx = await getContext();
  const page = await ctx.newPage();
  try {
    await page.goto(`file://${tmpFile}`, { waitUntil: "networkidle" });
    const locator = page.locator("img");
    await locator.waitFor({ state: "visible", timeout: 5000 });
    const handle = await locator.elementHandle();
    if (!handle) {
      throw new Error(`Failed to resolve image handle for ${inputPath}`);
    }

    await settlePageForCapture(page);
    const buf = await captureAdaptiveJpeg(handle, page, ctx);
    await fs.writeFile(outputPath, buf);
  } finally {
    await page.close();
    await fs.unlink(tmpFile).catch(() => undefined);
  }
}

export async function disposeRenderer(): Promise<void> {
  if (browserContext) {
    await browserContext.close().catch(() => undefined);
    browserContext = null;
  }
  if (browserInstance) {
    await browserInstance.close().catch(() => undefined);
    browserInstance = null;
  }
}
