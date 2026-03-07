import { describe, expect, it } from "vitest";
import componentPreview from "../src/index";

describe("vite-plugin-component-preview entry", () => {
  it("skips Svelte style virtual modules", () => {
    const plugin = componentPreview();
    plugin.configResolved?.({ command: "serve", root: "/repo" } as any);

    const out = plugin.transform?.(
      ".logo { height: 6em; }",
      "/repo/src/App.svelte?svelte&type=style&lang.css",
    );

    expect(out).toBeNull();
  });

  it("still transforms regular Svelte source modules", () => {
    const plugin = componentPreview();
    plugin.configResolved?.({ command: "serve", root: "/repo" } as any);

    const out = plugin.transform?.("<main><h1>hello</h1></main>", "/repo/src/App.svelte");

    expect(out).not.toBeNull();
  });
});
