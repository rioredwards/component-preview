// Patch appended to the Vite-pre-bundled react-jsx-dev-runtime.js.
//
// Background: React 19 drops the `source` argument that Babel's JSX transform
// passes to jsxDEV (5th param: { fileName, lineNumber, columnNumber }). Instead
// it stores `_debugStack = new Error()` whose `.stack` contains *compiled* line
// numbers that don't match the original source file.
//
// Fix: wrap jsxDEV and copy the Babel-computed lineNumber into a `data-src-line`
// prop on host (string-type) elements. React passes `data-*` attributes through
// to the DOM without warnings. The prop also lands on fiber.memoizedProps where
// our evaluate code can read it — giving exact source line numbers.
//
// The module uses var-scoped `require_jsx_dev_runtime` (esbuild __commonJS
// pattern), so this IIFE can call it to get the cached exports object and
// re-assign jsxDEV before App.jsx's import binding is resolved.
export const JSX_DEV_RUNTIME_PATCH = `
;(function () {
  if (typeof require_jsx_dev_runtime === "undefined") { return; }
  var mod = require_jsx_dev_runtime();
  if (!mod || typeof mod.jsxDEV !== "function") { return; }
  var orig = mod.jsxDEV;
  mod.jsxDEV = function (type, config, key, isStatic, source, self) {
    if (source && typeof type === "string" && source.lineNumber != null) {
      config = Object.assign({}, config, { "data-src-line": source.lineNumber });
    }
    return orig(type, config, key, isStatic, source, self);
  };
})();
`;
