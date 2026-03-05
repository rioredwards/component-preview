import { describe, expect, it } from "vitest";
import { transformJsx } from "../src/transformJsx";

describe("transformJsx", () => {
  it("injects preview attributes on host JSX tags", () => {
    const code = [
      "export function App() {",
      "  return (",
      "    <>",
      "      <div className=\"a\"><span>one</span><span>two</span></div>",
      "      <Component foo=\"bar\" />",
      "      <img src=\"/x.png\" />",
      "    </>",
      "  );",
      "}",
    ].join("\n");

    const out = transformJsx(code, "/repo/src/App.tsx", "src/App.tsx");
    expect(out).not.toBeNull();
    expect(out!.code.match(/data-cp-file="src\/App.tsx"/g)?.length).toBe(4);
    expect(out!.code).not.toContain("<Component foo=\"bar\" data-cp-file=");
    expect(out!.code).toContain("data-cp-line=\"4\"");
    expect(out!.code).toContain("data-cp-col=");
    expect(out!.code).toContain("data-cp-loc=");
  });

  it("creates a source map when code is changed", () => {
    const code = "export const x = <div>hello</div>;";
    const out = transformJsx(code, "/repo/src/file.tsx", "src/file.tsx");
    expect(out).not.toBeNull();
    expect(out!.map.mappings.length).toBeGreaterThan(0);
    expect(out!.map.sources).toContain("/repo/src/file.tsx");
  });
});
