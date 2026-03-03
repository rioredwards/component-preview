---
name: inspect-fibers
description: Run the fiber inspector to test which React element the extension would select for a given source line. Use when debugging or improving the React hover preview (devServerRenderer.ts).
argument-hint: [line-number]
allowed-tools: Bash
---

Run the fiber inspector for line $ARGUMENTS and analyse the results:

```
!`cd /workspaces/component-preview && pnpm run inspect-fibers $ARGUMENTS 2>&1`
```

Based on the output above:

1. **Confirm the intercept worked** — every host element in the fiber tree should have a `line=N` value. If you see `line=?` for most elements, the jsxDEV route intercept failed.

2. **Report the winner** — which element was selected (`← SELECTED`) and whether that matches what a developer would expect when hovering over that line in the source file.

3. **Flag any scoring problems** — if the wrong element was chosen (e.g. a tiny `<span>` instead of the surrounding `<section>`), explain why the scoring picked it and suggest a fix to `scoreFiber()` in `devServerRenderer.ts`.

4. **Note the screenshot** — confirm it was saved to `/tmp/inspect-fibers-$ARGUMENTS.jpeg` and the reported `size` and `box` dimensions look reasonable (height > 0, not a 1×1 pixel ghost element).
