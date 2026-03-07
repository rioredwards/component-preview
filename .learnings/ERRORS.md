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
## [ERR-20260306-007] trash-tmp-permission

**Logged**: 2026-03-06T20:26:09Z
**Priority**: low
**Status**: resolved
**Area**: config

### Summary
`trash` failed for `/tmp/hover-fixture-debug` with access denied on macOS.

### Error
```text
NSCocoaErrorDomain Code=513 ... afpAccessDenied
```

### Context
- Command attempted: `trash /tmp/hover-fixture-debug`
- Goal: remove source folder after moving fixture into repo

### Suggested Fix
Use `rm -rf` for `/tmp` cleanup when Trash is not permitted by OS behavior.

### Metadata
- Reproducible: yes
- Related Files: fixtures/hover-fixture-debug

### Resolution
- **Resolved**: 2026-03-06T20:26:09Z
- **Commit/PR**: uncommitted
- **Notes**: Removed the `/tmp` source with `rm -rf` after confirming repo copy existed.

---
## [ERR-20260306-008] extension-test-no-server-flake-with-live-5173

**Logged**: 2026-03-06T23:11:30Z
**Priority**: medium
**Status**: resolved
**Area**: tests

### Summary
Diagnostic hover test failed when a live dev server on `localhost:5173` was detected from workspace hints, producing mismatch diagnostic text instead of no-server text.

### Error
```text
AssertionError [ERR_ASSERTION]: Expected no-server hover text, got:
Detected dev server: `http://localhost:5173`.
...
The preview could not match this hover target.
```

### Context
- Command attempted: `npm run test:demo:hover`
- File: `src/test/extension.test.ts`
- `detectDevServer` correctly selected a live hinted server, but the test assumed no server would be found

### Suggested Fix
Assert for diagnostic behavior instead of only no-server wording when no matching preview target is available.

### Metadata
- Reproducible: yes
- Related Files: src/test/extension.test.ts, src/devServerDetector.ts

### Resolution
- **Resolved**: 2026-03-06T23:11:30Z
- **Commit/PR**: uncommitted
- **Notes**: Renamed test and updated assertion to accept either no-server or mismatch diagnostics, then reran `npm run test:demo:hover` successfully.

---
## [ERR-20260306-009] fixture-dev-missing-dependencies

**Logged**: 2026-03-06T23:21:40Z
**Priority**: medium
**Status**: resolved
**Area**: tests

### Summary
The in-repo debug fixture failed to start because dependencies were not installed in `fixtures/hover-fixture-debug`.

### Error
```text
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'vite' imported from .../.vite-temp/...
```

### Context
- Command attempted: `npm --prefix fixtures/hover-fixture-debug run dev`
- Fresh fixture copy included `package-lock.json` but no `node_modules`
- This created confusion during manual extension verification

### Suggested Fix
Make the root `fixture:hover:dev` script install fixture dependencies before launching Vite.

### Metadata
- Reproducible: yes
- Related Files: package.json, README.md, fixtures/hover-fixture-debug/package.json

### Resolution
- **Resolved**: 2026-03-06T23:21:40Z
- **Commit/PR**: uncommitted
- **Notes**: Updated `fixture:hover:dev` to run fixture install first, verified app booted on `http://127.0.0.1:5173/` with HTTP 200.

---
## [ERR-20260307-010] vscode-problem-matcher-schema-line-or-kind

**Logged**: 2026-03-07T01:01:36Z
**Priority**: high
**Status**: resolved
**Area**: config

### Summary
VS Code rejected the fixture task problem matcher because the pattern lacked `kind: "file"` and also lacked a line or location group.

### Error
```text
The problem pattern is invalid. It must either have kind: "file" or have a line or location match group.
Error: the description can't be converted into a problem matcher
```

### Context
- Operation attempted: Run prelaunch task `npm: fixture:hover:ensure` from `.vscode/tasks.json`
- Initial matcher used `file` and `message` groups only
- VS Code task provider activation failed before launching the task

### Suggested Fix
Use a schema-valid pattern that includes `file`, `line` or `location`, and `message`, even when the matcher is only needed for background begin/end signaling.

### Metadata
- Reproducible: yes
- Related Files: .vscode/tasks.json
- See Also: LRN-20260306-006

### Resolution
- **Resolved**: 2026-03-07T01:01:36Z
- **Commit/PR**: uncommitted
- **Notes**: Updated matcher pattern to `file + line + column + message` with an inert fixture-only regex and kept existing background begin/end patterns.

---
## [ERR-20260307-011] demo-hover-test-false-positive-match-on-shared-basename

**Logged**: 2026-03-07T04:59:00Z
**Priority**: high
**Status**: pending
**Area**: tests

### Summary
The diagnostic hover test can fail by rendering an image from an unrelated live app when the target file shares a basename like `App.tsx`.

### Error
```text
AssertionError [ERR_ASSERTION]: Expected no-server or mismatch hover diagnostic, got:
... image hover markdown with metadata source.file="src/App.tsx" ...
```

### Context
- Command attempted: `npm run test:demo:hover`
- A live server on `127.0.0.1:5173` was available.
- The no-target test file was `/tmp/.../App.tsx`, but the hover resolved to fixture element metadata from `src/App.tsx`.
- This indicates a basename-only false positive match in plugin adapter path matching.

### Suggested Fix
Tighten plugin adapter file matching to avoid suffix matches when request path is basename-only, and update the diagnostic test to avoid relying on ambient localhost state.

### Metadata
- Reproducible: yes
- Related Files: src/vitePluginAdapter.ts, src/test/extension.test.ts
- See Also: ERR-20260306-008

---
## [ERR-20260307-012] demo-hover-test-react-fiber-basename-fallback

**Logged**: 2026-03-07T05:07:53Z
**Priority**: high
**Status**: resolved
**Area**: tests

### Summary
`test:demo:hover` still failed after tightening Vite plugin matching because React fiber matching allowed basename-driven cross-app matches.

### Error
```text
AssertionError [ERR_ASSERTION]: Expected no-server or mismatch hover diagnostic, got:
... attachImage metadata adapter="react-fiber" source.file="src/App.tsx" ...
```

### Context
- Command attempted: `npm run test:demo:hover`
- Environment had another app live on 5173.
- `reactFiberAdapter.fileMatches` accepted `src/App.tsx` for a request targeting temp `App.tsx`.

### Suggested Fix
Apply basename-only strict matching in React adapter, and prefer explicit relative or absolute path matches before any substring fallback.

### Metadata
- Reproducible: yes
- Related Files: src/reactFiberAdapter.ts, src/test/extension.test.ts
- See Also: ERR-20260307-011

### Resolution
- **Resolved**: 2026-03-07T05:07:53Z
- **Commit/PR**: uncommitted
- **Notes**: Added basename guard and absolute-path matching in React and Vite adapters, then reran `npm run test:demo:hover` successfully.

---
## [ERR-20260307-013] direct-vscode-test-binary-not-in-shell-path

**Logged**: 2026-03-07T05:13:40Z
**Priority**: low
**Status**: resolved
**Area**: tests

### Summary
Running `vscode-test` directly from shell failed with exit code 127, while `npm run test` succeeded.

### Error
```text
zsh:1: command not found: vscode-test
```

### Context
- Command attempted: `npm run compile-tests && npm run compile && vscode-test --grep ...`
- The project-local `vscode-test` binary is available through npm script PATH wiring.

### Suggested Fix
Run extension-host tests via npm scripts (`npm run test -- --grep ...`) instead of invoking `vscode-test` directly.

### Metadata
- Reproducible: yes
- Related Files: package.json

### Resolution
- **Resolved**: 2026-03-07T05:13:40Z
- **Commit/PR**: uncommitted
- **Notes**: Reran with `npm run test -- --grep ...` and the targeted test passed.

---
