import { BrowserContext, ElementHandle, Page } from "playwright";
import {
  MAX_BYTES,
  MAX_CAPTURE_HEIGHT,
  MAX_CAPTURE_WIDTH,
  QUALITY_STEPS,
} from "./screenshotConstants";

const HIDDEN_OVERLAY_ATTR = "data-component-preview-hidden-overlay";
const PREV_STYLE_ATTR = "data-component-preview-prev-style";
const NO_PREV_STYLE = "__component_preview_no_prev_style__";

/**
 * Waits for common visual work to settle before taking a screenshot.
 * Includes finite animations, webfonts, and two rAF ticks.
 */
export async function settlePageForCapture(page: Page): Promise<void> {
  await page
    .evaluate(
      () =>
        Promise.race([
          Promise.all(
            document.getAnimations().map((a) => a.finished.catch(() => undefined)),
          ),
          new Promise<void>((resolve) => setTimeout(resolve, 500)),
        ]),
    )
    .catch(() => undefined);

  await page
    .evaluate(
      () =>
        Promise.race([
          document.fonts?.ready ?? Promise.resolve(),
          new Promise<void>((resolve) => setTimeout(resolve, 500)),
        ]),
    )
    .catch(() => undefined);

  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

/**
 * Screenshots a Playwright element using an adaptive
 * quality loop. If the result still exceeds the VS Code base64 limit after the
 * lowest quality step, falls back to a constrained-resize re-render.
 *
 * Returns a JPEG buffer guaranteed to fit within MAX_BYTES.
 */
export async function captureAdaptiveJpeg(
  target: ElementHandle,
  page: Page,
  ctx: BrowserContext,
): Promise<Buffer> {
  await target.scrollIntoViewIfNeeded();
  await hideFixedAndStickyOverlays(page, target);

  try {
    let buf: Buffer = Buffer.alloc(0);
    for (const quality of QUALITY_STEPS) {
      buf = await target.screenshot({ type: "jpeg", quality, animations: "disabled" });
      if (buf.length <= MAX_BYTES) {
        return buf;
      }
    }

    // Still too large: scale down via a constrained <img> re-render.
    const resizePage = await ctx.newPage();
    try {
      const b64 = buf.toString("base64");
      await resizePage.setContent(
        `<!DOCTYPE html><html><body style="margin:0;padding:0;overflow:hidden">` +
          `<img src="data:image/jpeg;base64,${b64}" ` +
          `style="max-width:${MAX_CAPTURE_WIDTH}px;max-height:${MAX_CAPTURE_HEIGHT}px;display:block;object-fit:contain">` +
          `</body></html>`,
      );
      const img = resizePage.locator("img");
      await img.waitFor({ state: "visible", timeout: 5000 });
      return await img.screenshot({ type: "jpeg", quality: QUALITY_STEPS[0], animations: "disabled" });
    } finally {
      await resizePage.close();
    }
  } finally {
    await restoreFixedAndStickyOverlays(page);
  }
}

/**
 * Hides fixed/sticky elements outside the target subtree to prevent headers
 * and floating UI from overlapping the captured element after scroll.
 */
async function hideFixedAndStickyOverlays(page: Page, target: ElementHandle): Promise<void> {
  await target.evaluate(
    (
      el: Element,
      attrs: { hidden: string; prev: string; noPrev: string },
    ) => {
      const targetEl = el instanceof HTMLElement ? el : null;
      if (!targetEl || !document.body) {
        return;
      }

      const { hidden, prev, noPrev } = attrs;
      for (const node of Array.from(document.querySelectorAll<HTMLElement>(`[${hidden}]`))) {
        node.removeAttribute(hidden);
        node.removeAttribute(prev);
      }

      for (const node of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
        if (
          node === targetEl ||
          node.contains(targetEl) ||
          targetEl.contains(node)
        ) {
          continue;
        }

        const position = window.getComputedStyle(node).position;
        if (position !== "fixed" && position !== "sticky") {
          continue;
        }

        const prevStyle = node.getAttribute("style");
        node.setAttribute(prev, prevStyle ?? noPrev);
        node.setAttribute(hidden, "1");
        node.style.setProperty("visibility", "hidden", "important");
        node.style.setProperty("pointer-events", "none", "important");
      }
    },
    {
      hidden: HIDDEN_OVERLAY_ATTR,
      prev: PREV_STYLE_ATTR,
      noPrev: NO_PREV_STYLE,
    },
  );
}

async function restoreFixedAndStickyOverlays(page: Page): Promise<void> {
  await page.evaluate(
    (
      attrs: { hidden: string; prev: string; noPrev: string },
    ) => {
      const { hidden, prev, noPrev } = attrs;
      for (const node of Array.from(document.querySelectorAll<HTMLElement>(`[${hidden}]`))) {
        const previous = node.getAttribute(prev);
        if (previous === noPrev || previous === null) {
          node.removeAttribute("style");
        } else {
          node.setAttribute("style", previous);
        }
        node.removeAttribute(hidden);
        node.removeAttribute(prev);
      }
    },
    {
      hidden: HIDDEN_OVERLAY_ATTR,
      prev: PREV_STYLE_ATTR,
      noPrev: NO_PREV_STYLE,
    },
  );
}
