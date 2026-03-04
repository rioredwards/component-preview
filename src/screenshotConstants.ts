// ~90k base64 chars is the practical VS Code MarkdownString truncation limit.
// 90_000 * 0.75 = 67_500 bytes (base64 expands bytes by 4/3).
export const MAX_BYTES = 67_500;

export const QUALITY_STEPS = [85, 70, 55, 40] as const;

// Use a desktop-first viewport so responsive layouts in previews are closer to
// what developers typically see in a real browser tab.
export const VIEWPORT_WIDTH = 1280;
export const VIEWPORT_HEIGHT = 900;

// Cap screenshot dimensions to prevent base64 strings that exceed VS Code's
// ~90k MarkdownString limit when fallback resizing is needed.
export const MAX_CAPTURE_WIDTH = 800;
export const MAX_CAPTURE_HEIGHT = 600;
