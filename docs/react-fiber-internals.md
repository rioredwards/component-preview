# React Fiber Internals — Implementation Notes for M3

Findings from implementing the React dev server render path. These are non-obvious internals
that caused real bugs or required research to understand.

---

## React 19 dropped `_debugSource`
 
The M3 plan originally assumed fibers carry `_debugSource = { fileName, lineNumber, columnNumber }`
(set by `babel-plugin-react-jsx-source`, which Vite/CRA enable in dev mode). This was true in
React 18. **React 19 removed it entirely.**

In React 19, `babel-plugin-react-jsx-source` still runs, and Babel still passes
`source = { fileName, lineNumber, columnNumber }` as the 5th argument to `jsxDEV`. But React 19's
`jsxDEV` implementation ignores this argument — it doesn't store it on the element or fiber.

Instead, React 19 stores `fiber._debugStack = new Error()`, an Error object captured inside
`jsxDEV` for use in owner-based component traces. React DevTools resolves this to source
locations using the browser's DevTools Protocol (source maps). We don't have access to that.

**Check:** `fiber._debugSource` is `null` for all fibers in React 19 apps.

---

## `_debugStack.stack` has compiled line numbers, not source line numbers

`_debugStack = new Error()` is created inside `jsxDEV`. The Error's `.stack` string has a frame
like `at App (http://localhost:5173/src/App.jsx:35:12)`. This looks promising, but line 35 is
the line in the **Vite-compiled output**, not the original source.

Why compiled ≠ source: Vite's `@vitejs/plugin-react` (Babel) transforms the entire JSX return
value into a single flat expression of nested `jsxDEV(...)` calls, like:

```js
return jsxDEV(Fragment, { children: [
  jsxDEV("div", { children: [
    jsxDEV("a", { ... children: jsxDEV("img", ..., { lineNumber: 13 }, ...) },
      ..., { lineNumber: 12 }, ...),
    ...
  ] }, ..., { lineNumber: 11 }, ...),
  jsxDEV("h1", ..., { lineNumber: 19 }, ...),   // ← compiled line ~35, source line 19
  ...
] }, ...)
```

All these calls end up on a handful of lines in the compiled file instead of one line per element
in the source. So a `<h1>` on source line 19 might appear at compiled line 35 — a 16-line offset
that grows with nesting depth throughout the file.

**Bottom line:** `_debugStack.stack` is useless for source line matching without source map
resolution (which requires the DevTools Protocol or the `source-map` library).

---

## The fix: intercept `jsxDEV` to inject `data-src-line`

Babel _does_ correctly compute source line numbers and passes them to `jsxDEV` as the `source`
argument. We recover them by wrapping `jsxDEV` before the React app loads.

**Mechanism:** Playwright's `page.route()` intercepts the pre-bundled
`react_jsx-dev-runtime.js` request and appends a patch. The patch exploits the fact that Vite
pre-bundles dependencies using esbuild's `__commonJS` wrapper pattern, which exposes a
module-scope `require_jsx_dev_runtime` variable. Our appended code calls it to get the
cached exports object and re-assigns `jsxDEV`:

```js
(function () {
  var mod = require_jsx_dev_runtime();         // cached exports object
  var orig = mod.jsxDEV;
  mod.jsxDEV = function (type, config, key, isStatic, source, self) {
    if (source && typeof type === "string" && source.lineNumber != null) {
      config = Object.assign({}, config, { "data-src-line": source.lineNumber });
    }
    return orig(type, config, key, isStatic, source, self);
  };
})();
```

The patch appends after `export default require_jsx_dev_runtime()`, so the module is fully
initialized. When `App.jsx` later evaluates `const jsxDEV = __vite__cjsImport0["jsxDEV"]`, it
gets our wrapper. `data-*` attributes are valid HTML and pass through React without warnings,
ending up in `fiber.memoizedProps["data-src-line"]` with the original Babel-computed line number.

**Important ordering guarantee:** ES modules evaluate their dependencies fully before evaluating
the importer. The patch (appended to react-jsx-dev-runtime.js) runs before App.jsx reads jsxDEV.

---

## Fiber root access: the stale HostRoot problem

React's `createRoot()` sets a `__reactContainer$<randomKey>` property on the root DOM element
(typically `#root`). This property always points to the **initial stale HostRoot fiber** — the
fiber created at startup, before any renders.

After each render, React's double-buffering swaps `FiberRootNode.current` to the newly committed
tree. The stale fiber's `stateNode` is the `FiberRootNode`. The live committed tree is:

```
stale.__reactContainer$xxx
  → stale (HostRoot fiber, always empty .child)
  → stale.stateNode (FiberRootNode)
  → stale.stateNode.current (live HostRoot fiber)
  → stale.stateNode.current.child (first real fiber, e.g. StrictMode)
```

**Common mistake:** using `(rootEl as any)[key]?.child` directly — this is always null because
the stale fiber's child is never populated. Always go through `.stateNode.current`.

---

## Candidate collection and scoring

Rather than exact line matching (which fails for lines inside a JSX tag's attribute list, blank
lines, comments, etc.), we:

1. **Collect all** fibers that reference the target file (any line number)
2. **Score each** by proximity to the hovered line:
   - Exact match → score 0 (highest)
   - Lines before the cursor → small negative score (element may still be "open" at the cursor)
   - Lines after the cursor → heavy negative score (3×) — element hadn't opened yet

This handles hovering over JSX attribute lines, closing tags, and blank lines inside a block,
all of which correctly fall back to the nearest containing element.

---

## Dev server page reuse

A single Playwright page is kept alive across all hovers (`devPage` module-level variable).
Navigating once and reusing the page is critical for performance — each `page.goto()` triggers
a full page load plus waiting for React to hydrate.

The page is recreated when the dev server URL changes. The route interceptor must be registered
between `ctx.newPage()` and `page.goto()` so it is active for the initial load.

On extension deactivate, `disposeDevPage()` closes the page. The browser singleton (in
`renderer.ts`) is shared with the static HTML path and is also closed on deactivate.
