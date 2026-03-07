import * as fs from "fs/promises";
import { ElementHandle, Page } from "playwright";
import { FindElementRequest, FrameworkAdapter } from "./frameworkAdapter";
import { info, log } from "./logger";
import { ReactFiberAdapter } from "./reactFiberAdapter";
import { getContext } from "./renderer";
import { captureAdaptiveJpeg, settlePageForCapture } from "./screenshotPipeline";
import { VitePluginAdapter } from "./vitePluginAdapter";

export interface DevServerRenderOptions {
  devServerUrl: string;
  workspaceRoot: string;
  filePath: string;
  line: number; // 1-based
  column: number; // 1-based
  outputPath: string;
}

type SourceLocationOrigin = "data-cp" | "data-src" | "request";

export interface DevServerMatchMetadata {
  adapter: FrameworkAdapter["name"];
  element: {
    tag: string;
    id: string | null;
    className: string | null;
    text: string | null;
  };
  source: {
    file: string;
    line: number;
    column: number;
    origin: SourceLocationOrigin;
  };
}

export const ERROR_MISSING_VITE_PLUGIN = "MISSING_VITE_PLUGIN";

export class MissingVitePluginError extends Error {
  readonly code = ERROR_MISSING_VITE_PLUGIN;
}

const adapters: FrameworkAdapter[] = [
  new VitePluginAdapter(),
  new ReactFiberAdapter(),
];

let devPage: Page | null = null;
let devPageUrl: string | null = null;
const selectedAdapterByOrigin = new Map<string, FrameworkAdapter["name"]>();

function getOriginKey(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

function fileIsPluginOnly(filePath: string): boolean {
  return /\.(vue|svelte)$/i.test(filePath);
}

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
  for (const adapter of adapters) {
    await adapter.initialize(devPage, devServerUrl);
  }

  await devPage.goto(devServerUrl, { waitUntil: "networkidle" });
  log("getDevPage: page loaded, url =", devPage.url());

  devPageUrl = devServerUrl;
  return devPage;
}

async function pickAdapter(
  page: Page,
  opts: DevServerRenderOptions,
): Promise<{ selected: FrameworkAdapter; detected: FrameworkAdapter[] }> {
  const detected: FrameworkAdapter[] = [];
  for (const adapter of adapters) {
    if (await adapter.detect(page)) {
      detected.push(adapter);
    }
  }

  if (detected.length === 0) {
    await invalidateDevPage();
    if (fileIsPluginOnly(opts.filePath)) {
      throw new MissingVitePluginError(
        "vite-plugin-component-preview is required for Vue/Svelte hover previews.",
      );
    }
    throw new Error("No compatible framework adapter detected on the current page.");
  }

  const origin = getOriginKey(opts.devServerUrl);
  const preferred = selectedAdapterByOrigin.get(origin);
  const selected = detected.find((adapter) => adapter.name === preferred) ?? detected[0];

  log(
    "pickAdapter: detected",
    detected.map((a) => a.name).join(", "),
    "selected",
    selected.name,
  );

  return { selected, detected };
}

async function findElementWithFallbacks(
  page: Page,
  opts: DevServerRenderOptions,
  selected: FrameworkAdapter,
  detected: FrameworkAdapter[],
): Promise<{ element: ElementHandle<Element>; adapter: FrameworkAdapter } | null> {
  const request: FindElementRequest = {
    workspaceRoot: opts.workspaceRoot,
    absoluteFilePath: opts.filePath,
    line: opts.line,
    column: opts.column,
  };

  const first = await selected.findElement(page, request);
  if (first) {
    selectedAdapterByOrigin.set(getOriginKey(opts.devServerUrl), selected.name);
    return { element: first, adapter: selected };
  }

  for (const adapter of detected) {
    if (adapter.name === selected.name) {
      continue;
    }
    const next = await adapter.findElement(page, request);
    if (next) {
      info(
        "Adapter fallback selected",
        adapter.name,
        "after",
        selected.name,
        "did not find a matching element.",
      );
      selectedAdapterByOrigin.set(getOriginKey(opts.devServerUrl), adapter.name);
      return { element: next, adapter };
    }
  }

  return null;
}

function coalesceSourceLocation(
  raw: {
    cpFile: string | null;
    cpLine: number | null;
    cpCol: number | null;
    srcFile: string | null;
    srcLine: number | null;
  },
  opts: DevServerRenderOptions,
): DevServerMatchMetadata["source"] {
  if (raw.cpFile && raw.cpLine !== null) {
    return {
      file: raw.cpFile,
      line: raw.cpLine,
      column: raw.cpCol ?? opts.column,
      origin: "data-cp",
    };
  }

  if (raw.srcFile && raw.srcLine !== null) {
    return {
      file: raw.srcFile,
      line: raw.srcLine,
      column: opts.column,
      origin: "data-src",
    };
  }

  return {
    file: opts.filePath,
    line: opts.line,
    column: opts.column,
    origin: "request",
  };
}

async function invalidateDevPage(): Promise<void> {
  if (devPage) {
    await devPage.close().catch(() => undefined);
    devPage = null;
    devPageUrl = null;
  }
}

export async function renderFromDevServer(
  opts: DevServerRenderOptions,
): Promise<DevServerMatchMetadata> {
  const page = await getDevPage(opts.devServerUrl);

  const { selected, detected } = await pickAdapter(page, opts);
  const matched = await findElementWithFallbacks(page, opts, selected, detected);

  if (!matched) {
    await invalidateDevPage();
    throw new Error(
      `No element found for ${opts.filePath}:${opts.line}:${opts.column} ` +
        `using adapters [${detected.map((a) => a.name).join(", ")}].`,
    );
  }

  const infoPayload = await matched.element.evaluate((el) => {
    const className =
      typeof el.className === "string" ? el.className : (el.getAttribute("class") ?? "");
    const parseNumericAttribute = (name: string): number | null => {
      const raw = el.getAttribute(name);
      if (!raw) {
        return null;
      }
      const parsed = Number.parseInt(raw, 10);
      return Number.isFinite(parsed) ? parsed : null;
    };

    return {
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      cls: className.slice(0, 80) || null,
      text: el.textContent?.trim().slice(0, 80) || null,
      cpFile: el.getAttribute("data-cp-file"),
      cpLine: parseNumericAttribute("data-cp-line"),
      cpCol: parseNumericAttribute("data-cp-col"),
      srcFile: el.getAttribute("data-src-file"),
      srcLine: parseNumericAttribute("data-src-line"),
      box: el.getBoundingClientRect(),
    };
  });

  const match: DevServerMatchMetadata = {
    adapter: matched.adapter.name,
    element: {
      tag: infoPayload.tag,
      id: infoPayload.id,
      className: infoPayload.cls,
      text: infoPayload.text,
    },
    source: coalesceSourceLocation(infoPayload, opts),
  };

  log(
    "renderFromDevServer: matched",
    JSON.stringify({
      adapter: match.adapter,
      tag: match.element.tag,
      id: match.element.id,
      cls: match.element.className,
      text: match.element.text,
      source: match.source,
      box: infoPayload.box,
    }),
  );

  const ctx = await getContext();
  await page.evaluate(() => window.scrollTo(0, 0));
  await settlePageForCapture(page);

  const buf = await captureAdaptiveJpeg(matched.element, page, ctx);
  log(`renderFromDevServer: screenshot size=${buf.length}`);
  await fs.writeFile(opts.outputPath, buf);
  return match;
}

export function disposeDevPage(): void {
  devPage?.close().catch(() => undefined);
  devPage = null;
  devPageUrl = null;
  selectedAdapterByOrigin.clear();

  for (const adapter of adapters) {
    adapter.dispose?.().catch(() => undefined);
  }
}
