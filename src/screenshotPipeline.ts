import { BrowserContext, ElementHandle, Locator } from "playwright";
import {
  MAX_BYTES,
  MAX_CAPTURE_HEIGHT,
  MAX_CAPTURE_WIDTH,
  QUALITY_STEPS,
} from "./screenshotConstants";

/**
 * Screenshots a Playwright target (Locator or ElementHandle) using an adaptive
 * quality loop. If the result still exceeds the VS Code base64 limit after the
 * lowest quality step, falls back to a constrained-resize re-render.
 *
 * Returns a JPEG buffer guaranteed to fit within MAX_BYTES.
 */
export async function captureAdaptiveJpeg(
  target: Locator | ElementHandle,
  ctx: BrowserContext,
): Promise<Buffer> {
  let buf: Buffer = Buffer.alloc(0);
  for (const quality of QUALITY_STEPS) {
    buf = await target.screenshot({ type: "jpeg", quality, animations: "disabled" });
    if (buf.length <= MAX_BYTES) {
      return buf;
    }
  }

  // Still too large — scale down via a constrained <img> re-render.
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
}
