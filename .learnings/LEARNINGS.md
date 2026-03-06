# Learnings Log

## [LRN-20260306-001] best_practice

**Logged**: 2026-03-06T19:18:43Z
**Priority**: high
**Status**: pending
**Area**: config

### Summary
TypeScript ESM libraries should use explicit `.js` relative import specifiers in source to produce Node-loadable `dist` output.

### Details
During runtime smoke import of `vite-plugin-component-preview`, Node ESM failed with `ERR_MODULE_NOT_FOUND` because built files imported extensionless paths such as `./pathUtils`. Updating source imports to `./pathUtils.js` style fixed runtime loading without breaking typecheck or tests.

### Suggested Action
Adopt explicit `.js` specifier convention for all relative imports in `packages/vite-plugin-component-preview/src/*` and add a runtime import smoke test to prevent regressions.

### Metadata
- Source: error
- Related Files: packages/vite-plugin-component-preview/src/index.ts, packages/vite-plugin-component-preview/src/injection.ts, packages/vite-plugin-component-preview/src/transformJsx.ts, packages/vite-plugin-component-preview/src/transformVue.ts, packages/vite-plugin-component-preview/src/transformSvelte.ts
- Tags: esm, typescript, runtime, packaging
- Pattern-Key: harden.esm-relative-import-specifiers

---
