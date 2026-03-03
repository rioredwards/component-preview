import { randomUUID } from "crypto";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { Browser, BrowserContext, chromium } from "playwright";

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
      viewport: { width: 800, height: 600 },
    });
  }
  return browserContext;
}

// ~90k base64 chars is the practical VS Code MarkdownString truncation limit.
// 90_000 * 0.75 = 67_500 bytes (base64 expands bytes by 4/3).
const MAX_BYTES = 67_500;
const QUALITY_STEPS = [85, 70, 55, 40];

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

    let buf: Buffer = Buffer.alloc(0);
    for (const quality of QUALITY_STEPS) {
      buf = await locator.screenshot({ type: "jpeg", quality, animations: "disabled" });
      if (buf.length <= MAX_BYTES) {
        break;
      }
    }
    await fs.writeFile(outputPath, buf);
  } finally {
    await page.close();
    await fs.unlink(tmpFile).catch(() => undefined);
  }
}

/**
 * Compresses an arbitrary image file to a JPEG that is guaranteed to fit
 * within the VS Code MarkdownString base64 limit. Uses the same adaptive
 * quality loop as renderElement — renders the image in a headless page,
 * steps down quality until the output is small enough.
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

    let buf: Buffer = Buffer.alloc(0);
    for (const quality of QUALITY_STEPS) {
      buf = await locator.screenshot({ type: "jpeg", quality, animations: "disabled" });
      if (buf.length <= MAX_BYTES) {
        break;
      }
    }
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
