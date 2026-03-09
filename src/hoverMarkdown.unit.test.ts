import { describe, expect, it } from "vitest";
import { assembleHoverMarkdown } from "./hoverMarkdown";
import { MAX_BYTES, MAX_MARKDOWN_LENGTH } from "./screenshotConstants";

describe("assembleHoverMarkdown", () => {
  const textOnlyHeader = "[**Component Preview**](https://example.com)";
  const actionLinks = "[$(copy)](command:foo \"Copy\") [$(git-pull-request)](command:bar \"PR\")";

  it("returns markdown within MAX_MARKDOWN_LENGTH for a small image", () => {
    const previewBase64 = "A".repeat(1000);
    const brandHeader = textOnlyHeader;
    const result = assembleHoverMarkdown(
      previewBase64,
      "image/jpeg",
      brandHeader,
      textOnlyHeader,
      actionLinks,
    );
    expect(result.length).toBeLessThanOrEqual(MAX_MARKDOWN_LENGTH);
    expect(result).toContain(brandHeader);
  });

  it("stays within MAX_MARKDOWN_LENGTH when brand header icon + preview fill the budget", () => {
    // Simulate ~18 KB icon → ~24k base64 chars in the brand header
    const iconBase64 = "I".repeat(24_000);
    const brandHeader =
      `<img src="data:image/png;base64,${iconBase64}" width="32" height="32" /> ` +
      textOnlyHeader;

    // Preview image at the MAX_BYTES limit → ceil(MAX_BYTES * 4/3) base64 chars
    const previewBase64 = "P".repeat(Math.ceil(MAX_BYTES * (4 / 3)));

    const result = assembleHoverMarkdown(
      previewBase64,
      "image/jpeg",
      brandHeader,
      textOnlyHeader,
      actionLinks,
    );
    expect(result.length).toBeLessThanOrEqual(MAX_MARKDOWN_LENGTH);
  });

  it("drops the icon image from the brand header when the total would overflow", () => {
    const iconBase64 = "I".repeat(24_000);
    const brandHeader =
      `<img src="data:image/png;base64,${iconBase64}" width="32" height="32" /> ` +
      textOnlyHeader;

    const previewBase64 = "P".repeat(Math.ceil(MAX_BYTES * (4 / 3)));

    const result = assembleHoverMarkdown(
      previewBase64,
      "image/jpeg",
      brandHeader,
      textOnlyHeader,
      actionLinks,
    );

    // Should NOT contain the icon base64 (it was dropped)
    expect(result).not.toContain(iconBase64);
    // Should still contain the text-only header
    expect(result).toContain(textOnlyHeader);
    // The preview image must be intact
    expect(result).toContain(previewBase64);
  });

  it("keeps the icon when total is within budget", () => {
    const iconBase64 = "I".repeat(100);
    const brandHeader =
      `<img src="data:image/png;base64,${iconBase64}" /> ` + textOnlyHeader;

    const previewBase64 = "P".repeat(1000);

    const result = assembleHoverMarkdown(
      previewBase64,
      "image/jpeg",
      brandHeader,
      textOnlyHeader,
      actionLinks,
    );
    expect(result).toContain(iconBase64);
    expect(result).toContain(textOnlyHeader);
  });
});
