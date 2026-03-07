# Smoke Test Log

Purpose: lightweight manual validation record for beta releases.

How to use:
- Add a dated entry each time you do manual smoke testing.
- Keep it short: fixture/app, result, and notable bugs.
- Link related backlog items when known.

---

## 2026-03-07

### Scope
- Manual smoke tests during beta validation of hover preview behavior.

### Environment
- Local dev on macOS
- Extension under active development in `component-preview`

### Results
- Vite + React (JavaScript fixture):
  - Working for core hover-preview flow.
  - Known bug observed: composite component hover can capture only a partial region (first host child), not full composite output.
- Vite + React (TypeScript fixture):
  - Working for core hover-preview flow.
  - Same known composite-capture limitation observed.
- Vite + Vue (JavaScript fixture):
  - Working when `vite-plugin-component-preview` is enabled (expected requirement).
- Vite + Svelte:
  - Pending (next test).

### Known issues noted in this session
- Composite React fallback capture may show only one child region for fragment/composite hovers.
  - Backlog: `BACKLOG.md` → `[P1] Fallback hover on composite React components should capture full rendered output (not first host child)`

### Overall status
- Smoke tests mostly green for current beta scope with known non-blocking issues logged.
