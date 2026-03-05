import { describe, expect, it } from "vitest";
import { pickBestViteCandidate, scoreViteCandidate } from "./vitePluginAdapter";

describe("vitePluginAdapter scoring", () => {
  it("prefers exact line and column over nearby candidates", () => {
    const exact = scoreViteCandidate(
      { line: 10, column: 4, visible: true },
      10,
      4,
    );
    const near = scoreViteCandidate(
      { line: 10, column: 7, visible: true },
      10,
      4,
    );
    expect(exact).toBeGreaterThan(near);
  });

  it("penalizes lines after cursor more than lines before cursor", () => {
    const before = scoreViteCandidate(
      { line: 8, column: 1, visible: true },
      10,
      1,
    );
    const after = scoreViteCandidate(
      { line: 12, column: 1, visible: true },
      10,
      1,
    );
    expect(before).toBeGreaterThan(after);
  });

  it("picks the best candidate index", () => {
    const candidates = [
      { line: 5, column: 1, visible: true },
      { line: 12, column: 5, visible: true },
      { line: 10, column: 3, visible: true },
    ];

    const index = pickBestViteCandidate(candidates, 10, 3);
    expect(index).toBe(2);
  });
});
