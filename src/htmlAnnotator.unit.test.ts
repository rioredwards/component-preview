import { parse } from "node-html-parser";
import { describe, expect, it } from "vitest";
import { annotateHtml, elementIdentityFromNode, findDeepestAtOffset } from "./htmlAnnotator";

describe("findDeepestAtOffset", () => {
  it("returns the element containing the offset", () => {
    const html = "<div><p>hello</p></div>";
    const root = parse(html);
    // Offset inside <p>: "hello" starts after "<div><p>" = 8
    const el = findDeepestAtOffset(root, 9);
    expect(el).not.toBeNull();
    expect(el!.tagName).toBe("P");
  });

  it("returns null for offset outside any element", () => {
    const html = "<div>hi</div>";
    const root = parse(html);
    // Offset way beyond the end of the string
    const el = findDeepestAtOffset(root, 999);
    expect(el).toBeNull();
  });

  it("returns the deepest nested element", () => {
    const html = "<div><section><span>deep</span></section></div>";
    const root = parse(html);
    // Offset inside "deep" text: after "<div><section><span>" = 20
    const el = findDeepestAtOffset(root, 21);
    expect(el).not.toBeNull();
    expect(el!.tagName).toBe("SPAN");
  });

  it("returns outer element when offset is in the gap between children", () => {
    const html = "<div><p>a</p>   <p>b</p></div>";
    const root = parse(html);
    // Offset in the whitespace between the two <p> tags
    const pClose = html.indexOf("</p>") + 4; // after first </p>
    const el = findDeepestAtOffset(root, pClose + 1);
    expect(el).not.toBeNull();
    expect(el!.tagName).toBe("DIV");
  });
});

describe("elementIdentityFromNode", () => {
  it("uses #id when element has an id attribute", () => {
    const root = parse('<div id="main">content</div>');
    const el = root.querySelector("#main")!;
    expect(elementIdentityFromNode(el)).toBe("#main");
  });

  it("uses data-testid over structural path", () => {
    const root = parse('<div data-testid="hero">content</div>');
    const el = root.querySelector("[data-testid]")!;
    expect(elementIdentityFromNode(el)).toBe('[data-testid="hero"]');
  });

  it("uses data-component over structural path", () => {
    const root = parse('<div data-component="Header">content</div>');
    const el = root.querySelector("[data-component]")!;
    expect(elementIdentityFromNode(el)).toBe('[data-component="Header"]');
  });

  it("prefers id over data-testid", () => {
    const root = parse('<div id="foo" data-testid="bar">content</div>');
    const el = root.querySelector("#foo")!;
    expect(elementIdentityFromNode(el)).toBe("#foo");
  });

  it("builds structural path when no stable attributes exist", () => {
    const html = "<html><body><main><h1>title</h1></main></body></html>";
    const root = parse(html);
    const el = root.querySelector("h1")!;
    expect(elementIdentityFromNode(el)).toBe("html > body > main > h1");
  });

  it("uses :nth-of-type for same-tag siblings", () => {
    const html = "<ul><li>a</li><li>b</li><li>c</li></ul>";
    const root = parse(html);
    const lis = root.querySelectorAll("li");
    expect(elementIdentityFromNode(lis[0])).toContain("li:nth-of-type(1)");
    expect(elementIdentityFromNode(lis[1])).toContain("li:nth-of-type(2)");
    expect(elementIdentityFromNode(lis[2])).toContain("li:nth-of-type(3)");
  });
});

describe("annotateHtml", () => {
  it("injects data-hover-id into the target element", () => {
    const html = '<div><p class="intro">hello</p></div>';
    const offset = html.indexOf("hello");
    const result = annotateHtml(html, offset);
    expect(result).not.toBeNull();
    expect(result!.html).toContain("data-hover-id=");
    expect(result!.html).toContain(result!.hoverId);
  });

  it("returns null when offset is outside all elements", () => {
    const html = "<div>hi</div>";
    const result = annotateHtml(html, 999);
    expect(result).toBeNull();
  });

  it("respects quotes when scanning for > in attributes", () => {
    const html = '<div title="a > b">content</div>';
    const offset = html.indexOf("content");
    const result = annotateHtml(html, offset);
    expect(result).not.toBeNull();
    // The data-hover-id should be injected before the real closing >
    // not at the > inside the attribute value
    const hoverIdPattern = /data-hover-id="[^"]+"/;
    expect(result!.html).toMatch(hoverIdPattern);
    // The attribute with > should still be intact
    expect(result!.html).toContain('title="a > b"');
  });

  it("returns a valid elementId for the target", () => {
    const html = '<div id="hero"><span>text</span></div>';
    const offset = html.indexOf("text");
    const result = annotateHtml(html, offset);
    expect(result).not.toBeNull();
    // span has no id/data-testid, so it gets a structural path
    expect(result!.elementId).toContain("span");
  });
});
