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
