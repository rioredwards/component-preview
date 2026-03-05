import { describe, expect, it } from "vitest";
import { transformSvelte } from "../src/transformSvelte";

describe("transformSvelte", () => {
  it("injects metadata in markup and leaves script/style untouched", () => {
    const code = [
      "<script lang=\"ts\">",
      "  const marker = \"<div>script-only</div>\";",
      "</script>",
      "",
      "<div class=\"card\">",
      "  {#if show}",
      "    <Card title=\"x\" />",
      "  {/if}",
      "</div>",
      "",
      "<style>",
      ".card { color: white; }",
      "</style>",
    ].join("\n");

    const out = transformSvelte(code, "/repo/src/App.svelte", "src/App.svelte");
    expect(out).not.toBeNull();
    expect(out!.code.match(/data-cp-file="src\/App.svelte"/g)?.length).toBe(2);
    expect(out!.code).toContain("const marker = \"<div>script-only</div>\";");
    expect(out!.code).toContain(".card { color: white; }");
    expect(out!.code).toContain("data-cp-line=\"5\"");
  });
});
