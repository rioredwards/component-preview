import { describe, expect, it } from "vitest";
import { scoreFiber } from "./fiberScoring";

describe("scoreFiber", () => {
  it("returns 0 for an exact match", () => {
    expect(scoreFiber(10, 10)).toBe(0);
  });

  it("returns a negative score for candidates before target", () => {
    expect(scoreFiber(8, 10)).toBeLessThan(0);
  });

  it("returns a negative score for candidates after target", () => {
    expect(scoreFiber(12, 10)).toBeLessThan(0);
  });

  it("penalizes after-target 3x heavier than before-target at same distance", () => {
    const before = scoreFiber(8, 10); // distance 2
    const after = scoreFiber(12, 10); // distance 2
    expect(after).toBe(before * 3);
  });

  it("degrades monotonically with distance (before target)", () => {
    const close = scoreFiber(9, 10);
    const far = scoreFiber(5, 10);
    expect(close).toBeGreaterThan(far);
  });

  it("degrades monotonically with distance (after target)", () => {
    const close = scoreFiber(11, 10);
    const far = scoreFiber(15, 10);
    expect(close).toBeGreaterThan(far);
  });

  it("before-cursor always beats equal-distance after-cursor", () => {
    for (const dist of [1, 2, 5, 10, 50]) {
      const target = 100;
      const before = scoreFiber(target - dist, target);
      const after = scoreFiber(target + dist, target);
      expect(before).toBeGreaterThan(after);
    }
  });
});
