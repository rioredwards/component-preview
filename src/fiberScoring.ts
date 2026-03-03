/**
 * Scores a candidate fiber by proximity to the target line.
 *
 * - Exact match = 0 (best)
 * - Before target = small negative penalty (plausibly an "open" container)
 * - After target = 3x heavier negative penalty (hasn't opened yet)
 *
 * Higher (closer to 0) is better. The page.evaluate callbacks in
 * devServerRenderer.ts keep inline copies (browser boundary constraint)
 * but this is the canonical, tested version.
 */
export function scoreFiber(candidateLine: number, targetLine: number): number {
  if (candidateLine === targetLine) {
    return 0;
  }
  if (candidateLine < targetLine) {
    return -(targetLine - candidateLine);
  }
  return -(candidateLine - targetLine) * 3;
}
