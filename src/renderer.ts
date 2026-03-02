import * as os from 'os';
import * as fs from 'fs/promises';
import * as path from 'path';
import { chromium, Browser, BrowserContext } from 'playwright';

export interface RenderOptions {
  html: string;
  hoverId: string;
  outputPath: string;
}

let browserInstance: Browser | null = null;
let browserContext: BrowserContext | null = null;

async function getContext(): Promise<BrowserContext> {
  if (!browserInstance) {
    browserInstance = await chromium.launch({ headless: true });
  }
  if (!browserContext) {
    browserContext = await browserInstance.newContext();
  }
  return browserContext;
}

export async function renderElement(opts: RenderOptions): Promise<void> {
  const { html, hoverId, outputPath } = opts;

  const tmpFile = path.join(os.tmpdir(), `hover-${hoverId}.html`);
  await fs.writeFile(tmpFile, html, 'utf8');

  const ctx = await getContext();
  const page = await ctx.newPage();
  try {
    await page.goto(`file://${tmpFile}`, { waitUntil: 'networkidle' });
    const locator = page.locator(`[data-hover-id="${hoverId}"]`);
    await locator.waitFor({ state: 'visible', timeout: 5000 });
    await locator.screenshot({ path: outputPath, animations: 'disabled' });
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
