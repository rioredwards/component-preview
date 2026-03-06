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
## [LRN-20260306-002] correction

**Logged**: 2026-03-06T19:47:37Z
**Priority**: high
**Status**: pending
**Area**: backend

### Summary
Dev-server discovery must be workspace-aware and must not silently pick another running app on localhost.

### Details
During regression triage, I initially reproduced against `http://localhost:3000` and the user corrected that the relevant app was `http://localhost:5173/`. This exposed a core product risk: fallback probing by common ports can bind to an unrelated repo and return irrelevant hover results.

### Suggested Action
Prioritize deterministic workspace-scoped discovery with explicit user confirmation when confidence is low, and de-prioritize blind common-port fallback.

### Metadata
- Source: user_feedback
- Related Files: src/devServerDetector.ts, src/hoverProvider.ts, src/devServerRenderer.ts
- Tags: correction, dev-server-discovery, workspace-scoping

---
## [LRN-20260306-003] best_practice

**Logged**: 2026-03-06T19:54:39Z
**Priority**: medium
**Status**: pending
**Area**: tests

### Summary
For ESM modules in Vitest, prefer module-level test dependency injection over `vi.spyOn` on Node namespace imports.

### Details
`vi.spyOn(fs, "readFile")` failed because ESM namespace exports are non-configurable. The stable approach was to add explicit test hooks (`setDetectorDepsForTests` / `resetDetectorDepsForTests`) and stub `readFile` and `probe` behavior through injected dependencies.

### Suggested Action
Use dependency injection hooks when testing modules that import Node built-ins via ESM namespace imports.

### Metadata
- Source: error
- Related Files: src/devServerDetector.ts, src/devServerDetector.unit.test.ts
- Tags: vitest, esm, testing, dependency-injection
- Pattern-Key: harden.vitest-esm-mocking

---
## [LRN-20260306-004] correction

**Logged**: 2026-03-06T20:01:21Z
**Priority**: high
**Status**: pending
**Area**: frontend

### Summary
If JSX render fails after detection, returning `null` produces no visible feedback. Show an explicit hover diagnostic instead.

### Details
I said the extension would ask for explicit `component-preview.devServerUrl`, but the existing code only showed no-server guidance when detection returned `null`. On render failures, it returned `null`, so users saw the loading state disappear with no message.

### Suggested Action
Always return a diagnostic hover on dev-server render failures, including detected URL and clear override instructions.

### Metadata
- Source: user_feedback
- Related Files: src/hoverProvider.ts
- Tags: correction, ux, diagnostics, hover

---
## [LRN-20260306-005] best_practice

**Logged**: 2026-03-06T20:08:38Z
**Priority**: medium
**Status**: pending
**Area**: tests

### Summary
For VS Code extension-host tests, explicitly activate the extension and avoid workspace-folder scoped config updates unless a workspace is open.

### Details
`vscode.executeHoverProvider` tests can fail silently if the extension is not yet active. In no-workspace test runs, `ConfigurationTarget.WorkspaceFolder` throws a settings write error. Explicit activation plus global-scoped settings made hover assertions deterministic.

### Suggested Action
Keep an activation helper in extension tests and default to `ConfigurationTarget.Global` unless workspace setup is part of the test fixture.

### Metadata
- Source: error
- Related Files: src/test/extension.test.ts
- Tags: vscode-test, integration, activation, settings
- Pattern-Key: harden.vscode-test-activation-and-config-scope

---
