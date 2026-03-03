import * as path from "path";
import { describe, expect, it } from "vitest";
import { inlineStyles } from "./cssInliner";

const FIXTURES = path.join(__dirname, "__fixtures__");

describe("inlineStyles", () => {
  it("returns HTML unchanged when there are no link tags", async () => {
    const html = "<html><body><h1>hi</h1></body></html>";
    const result = await inlineStyles(html, FIXTURES);
    expect(result).toBe(html);
  });

  it("inlines a local stylesheet as a <style> block", async () => {
    const html = '<html><head><link rel="stylesheet" href="basic.css"></head><body></body></html>';
    const result = await inlineStyles(html, FIXTURES);
    expect(result).not.toContain("<link");
    expect(result).toContain("<style>");
    expect(result).toContain("body { margin: 0; }");
    expect(result).toContain("h1 { color: red; }");
  });

  it("leaves external URLs untouched", async () => {
    const html =
      '<html><head><link rel="stylesheet" href="https://cdn.example.com/style.css"></head><body></body></html>';
    const result = await inlineStyles(html, FIXTURES);
    expect(result).toContain("https://cdn.example.com/style.css");
    expect(result).toContain("<link");
  });

  it("handles missing file gracefully without crashing", async () => {
    const html =
      '<html><head><link rel="stylesheet" href="nonexistent.css"></head><body></body></html>';
    const result = await inlineStyles(html, FIXTURES);
    // Link tag stays as-is since the file couldn't be read
    expect(result).toContain("<link");
  });

  it("resolves one level of @import", async () => {
    const html =
      '<html><head><link rel="stylesheet" href="with-import.css"></head><body></body></html>';
    const result = await inlineStyles(html, FIXTURES);
    expect(result).toContain("<style>");
    // The @import should be replaced with the imported file contents
    expect(result).toContain(".imported { display: flex; }");
    // The rest of with-import.css should be present
    expect(result).toContain("h2 { font-size: 2em; }");
    // The @import directive itself should be gone
    expect(result).not.toContain("@import");
  });
});
