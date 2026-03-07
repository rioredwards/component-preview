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

  it("handles arrow functions in JSX attributes without breaking syntax", () => {
    const code = [
      "export function Card({ onSelect, name }) {",
      "  return (",
      '    <article onClick={() => onSelect(name)}>',
      "      <p>hello</p>",
      "    </article>",
      "  );",
      "}",
    ].join("\n");

    const out = transformJsx(code, "/repo/src/Card.tsx", "src/Card.tsx");
    expect(out).not.toBeNull();
    // Attributes must be before the closing > of the tag, not inside the arrow =>
    expect(out!.code).toContain('data-cp-file="src/Card.tsx"');
    expect(out!.code).toMatch(/<article[^>]*onClick=\{[^}]*\}[^>]*data-cp-file=/);
    // The arrow function must remain intact
    expect(out!.code).toContain("() => onSelect(name)");
  });

  it("handles self-closing tags with spread props", () => {
    const code = [
      "export function Button({ className, ...rest }) {",
      '  return <button className={className} {...rest} />;',
      "}",
    ].join("\n");

    const out = transformJsx(code, "/repo/src/Button.tsx", "src/Button.tsx");
    expect(out).not.toBeNull();
    // Attributes must appear before />, not between / and >
    expect(out!.code).toMatch(/data-cp-file="src\/Button\.tsx"[^>]*\/>/);
    expect(out!.code).not.toMatch(/\/ data-cp-file/);
  });

  it("creates a source map when code is changed", () => {
    const code = "export const x = <div>hello</div>;";
    const out = transformJsx(code, "/repo/src/file.tsx", "src/file.tsx");
    expect(out).not.toBeNull();
    expect(out!.map.mappings.length).toBeGreaterThan(0);
    expect(out!.map.sources).toContain("/repo/src/file.tsx");
  });
});
