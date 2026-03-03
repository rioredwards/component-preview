// ~90k base64 chars is the practical VS Code MarkdownString truncation limit.
// 90_000 * 0.75 = 67_500 bytes (base64 expands bytes by 4/3).
export const MAX_BYTES = 67_500;

export const QUALITY_STEPS = [85, 70, 55, 40] as const;

// Cap screenshot dimensions to prevent base64 strings that exceed VS Code's
// ~90k MarkdownString limit. Matches the viewport set in getContext().
export const MAX_CAPTURE_WIDTH = 800;
export const MAX_CAPTURE_HEIGHT = 600;
