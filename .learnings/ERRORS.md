# Errors Log

## [ERR-20260306-001] pnpm-workspace-check

**Logged**: 2026-03-06T19:18:43Z
**Priority**: medium
**Status**: pending
**Area**: config

### Summary
Workspace validation command failed because `pnpm` is not installed in the shell environment.

### Error
```text
zsh:1: command not found: pnpm
```

### Context
- Command attempted: `pnpm --filter vite-plugin-component-preview run check-types`
- Root project has `pnpm-lock.yaml`, but local CLI path does not include `pnpm`
- Fallback to `npm` in package directory succeeded

### Suggested Fix
Document and standardize package manager tooling for local validation commands.

### Metadata
- Reproducible: yes
- Related Files: package.json, pnpm-lock.yaml

---

## [ERR-20260306-002] inspect-fibers-runtime-smoke

**Logged**: 2026-03-06T19:18:43Z
**Priority**: high
**Status**: resolved
**Area**: tests

### Summary
`inspect-fibers` smoke run failed during `page.evaluate` due missing `__name` helper in browser context.

### Error
```text
page.evaluate: ReferenceError: __name is not defined
```

### Context
- Command attempted: `npm run inspect-fibers -- --help`
- First run hit sandbox IPC issue (`listen EPERM`), rerun with elevated permissions passed startup
- Script does not implement `--help` handling, and transpiled callback code references helper state not present in page context

### Suggested Fix
Add explicit CLI argument validation in `scripts/inspect-fibers.ts` and avoid transpiler-dependent helper references inside `page.evaluate` callbacks.

### Metadata
- Reproducible: yes
- Related Files: scripts/inspect-fibers.ts

### Resolution
- **Resolved**: 2026-03-06T19:25:00Z
- **Commit/PR**: uncommitted
- **Notes**: Added strict CLI parsing with `--help`, `--line`, `--file`, and `--url`; invalid values now fail fast with usage text. `npm run inspect-fibers -- --help` exits before Playwright startup.

---

## [ERR-20260306-003] plugin-esm-runtime-import

**Logged**: 2026-03-06T19:18:43Z
**Priority**: high
**Status**: resolved
**Area**: backend

### Summary
Built ESM plugin could not be imported in Node because generated output used extensionless internal imports.

### Error
```text
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../dist/pathUtils' imported from '.../dist/index.js'
```

### Context
- Command attempted: `node --input-type=module -e "import componentPreview from './packages/vite-plugin-component-preview/dist/index.js'..."`
- Dist file imported `./pathUtils` instead of `./pathUtils.js`

### Suggested Fix
Use explicit `.js` specifiers for relative imports in plugin source files.

### Metadata
- Reproducible: yes
- Related Files: packages/vite-plugin-component-preview/src/index.ts, packages/vite-plugin-component-preview/src/transformJsx.ts, packages/vite-plugin-component-preview/src/transformVue.ts, packages/vite-plugin-component-preview/src/transformSvelte.ts, packages/vite-plugin-component-preview/src/injection.ts

### Resolution
- **Resolved**: 2026-03-06T19:18:43Z
- **Commit/PR**: uncommitted
- **Notes**: Updated plugin source relative imports to `.js`, rebuilt package, and reran runtime import smoke successfully.

---
## [ERR-20260306-004] vitest-esm-namespace-mocking

**Logged**: 2026-03-06T19:54:39Z
**Priority**: medium
**Status**: resolved
**Area**: tests

### Summary
New detector unit tests failed because `vi.spyOn` cannot redefine ESM namespace exports (`fs.readFile`).

### Error
```text
TypeError: Cannot spy on export "readFile". Module namespace is not configurable in ESM.
```

### Context
- Command attempted: `npm run test:unit`
- File: `src/devServerDetector.unit.test.ts`
- Initial test approach used `vi.spyOn(fs, "readFile")` and `vi.spyOn(http, "get")`

### Suggested Fix
Use explicit dependency injection hooks in the module under test instead of spying on ESM namespace exports.

### Metadata
- Reproducible: yes
- Related Files: src/devServerDetector.unit.test.ts, src/devServerDetector.ts

### Resolution
- **Resolved**: 2026-03-06T19:54:39Z
- **Commit/PR**: uncommitted
- **Notes**: Added `setDetectorDepsForTests` and `resetDetectorDepsForTests`, then rewired tests to stub detector dependencies directly.

---
## [ERR-20260306-005] extension-test-activation-and-config-target

**Logged**: 2026-03-06T20:08:38Z
**Priority**: medium
**Status**: resolved
**Area**: tests

### Summary
New extension-host tests initially failed because the extension was not explicitly activated and settings were written to WorkspaceFolder without an opened workspace.

### Error
```text
AssertionError: Expected no-server hover text, got:
CodeExpectedError: Unable to write to Folder Settings because no workspace is opened.
```

### Context
- Command attempted: `npm test`
- File: `src/test/extension.test.ts`
- `vscode.executeHoverProvider` returned no expected hover until explicit activation

### Suggested Fix
Activate the development extension explicitly in tests and write config with `ConfigurationTarget.Global` when no workspace is opened.

### Metadata
- Reproducible: yes
- Related Files: src/test/extension.test.ts

### Resolution
- **Resolved**: 2026-03-06T20:08:38Z
- **Commit/PR**: uncommitted
- **Notes**: Added explicit activation helper, language assertion, brief wait before hover execution, and switched config update target to global.

---
## [ERR-20260306-006] demo-hover-script-sandbox-sigabrt

**Logged**: 2026-03-06T20:11:40Z
**Priority**: low
**Status**: resolved
**Area**: tests

### Summary
`npm run test:demo:hover` aborted with `SIGABRT` when the VS Code extension host launched inside sandboxed execution.

### Error
```text
Exit code: SIGABRT
```

### Context
- Command attempted: `npm run test:demo:hover`
- Failure occurred during `vscode-test` extension host startup in sandbox mode
- Same command passed when rerun with escalated permissions

### Suggested Fix
Run extension-host demo tests with elevated permissions in this environment.

### Metadata
- Reproducible: yes
- Related Files: package.json, src/test/extension.test.ts

### Resolution
- **Resolved**: 2026-03-06T20:11:40Z
- **Commit/PR**: uncommitted
- **Notes**: Added approved prefix rule `npm run test:demo:hover` and validated successful rerun.

---
