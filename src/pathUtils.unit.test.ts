import { describe, expect, it } from "vitest";
import {
  normalizeForComparison,
  normalizeToPosix,
  normalizeWorkspaceRelativePath,
} from "./pathUtils";

describe("pathUtils", () => {
  it("normalizes path separators to posix", () => {
    expect(normalizeToPosix("src\\components\\Card.tsx")).toBe("src/components/Card.tsx");
  });

  it("creates a workspace-relative path", () => {
    const root = "/Users/dev/project";
    const file = "/Users/dev/project/src/App.tsx";
    expect(normalizeWorkspaceRelativePath(root, file)).toBe("src/App.tsx");
  });

  it("normalizes for case-insensitive comparisons", () => {
    expect(normalizeForComparison("Src\\App.TSX")).toBe("src/app.tsx");
  });
});
