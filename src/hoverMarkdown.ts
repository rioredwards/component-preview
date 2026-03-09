import { MAX_MARKDOWN_LENGTH } from "./screenshotConstants";

/**
 * Assembles the full hover tooltip markdown string.
 *
 * If the result exceeds VS Code's MarkdownString truncation limit, the brand
 * header is replaced with a text-only fallback (dropping the inline icon
 * image) to reclaim space.
 */
export function assembleHoverMarkdown(
  previewBase64: string,
  mime: string,
  brandHeader: string,
  textOnlyBrandHeader: string,
  actionLinks: string,
): string {
  const imageTag = `<img src="data:${mime};base64,${previewBase64}">`;
  const full = `${brandHeader}\n\n---\n\n${imageTag}\n\n---\n\n${actionLinks}`;

  if (full.length <= MAX_MARKDOWN_LENGTH) {
    return full;
  }

  return `${textOnlyBrandHeader}\n\n---\n\n${imageTag}\n\n---\n\n${actionLinks}`;
}
