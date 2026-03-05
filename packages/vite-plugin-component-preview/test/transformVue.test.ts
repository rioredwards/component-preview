import { describe, expect, it } from "vitest";
import { transformVue } from "../src/transformVue";

describe("transformVue", () => {
  it("injects attributes into template tags and skips script/style blocks", () => {
    const code = [
      "<template>",
      "  <div class=\"a\"><MyWidget /><span>ok</span></div>",
      "</template>",
      "<script setup lang=\"ts\">",
      "const marker = \"<div>not template</div>\";",
      "</script>",
      "<style scoped>",
      ".a { color: red; }",
      "</style>",
    ].join("\n");

    const out = transformVue(code, "/repo/src/App.vue", "src/App.vue");
    expect(out).not.toBeNull();
    expect(out!.code.match(/data-cp-file="src\/App.vue"/g)?.length).toBe(3);
    expect(out!.code).toContain("const marker = \"<div>not template</div>\";");
    expect(out!.code).toContain("<style scoped>");
    expect(out!.code).toContain("data-cp-line=\"2\"");
  });

  it("returns null when no template block exists", () => {
    const code = "<script setup>const n = 1;</script>";
    const out = transformVue(code, "/repo/src/App.vue", "src/App.vue");
    expect(out).toBeNull();
  });
});
