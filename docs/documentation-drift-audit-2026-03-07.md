# Documentation Drift Audit — 2026-03-07

Full pass across the repo to identify docs that no longer match the current implementation.

---

## High priority (misleading or wrong)

### 1. CLAUDE.md — Log file path

**Line 80:** `Log file for React path diagnostics: /tmp/component-preview-debug.log`

**Actual:** Log file is at `path.join(os.tmpdir(), "component-preview-debug.log")` — platform-specific (e.g. `%TEMP%\component-preview-debug.log` on Windows).

**Fix:** Update to: `Log file for React path diagnostics: <os.tmpdir()>/component-preview-debug.log` or similar.

---

### 2. VISION.md — plan.md does not exist

**Lines 186, 201:** References `plan.md` as the active sprint / working document.

**Actual:** Project uses `BACKLOG.md` for tickets. No `plan.md` exists.

**Fix:** Replace `plan.md` with `BACKLOG.md` or add a `plan.md` and document the workflow.

---

### 3. VISION.md — Logger and log file location

**Line 207:** "Structured logging via a central logger module (to be built in Milestone 2)"

**Line 211:** "debug logs are written to a rotating file in globalStorageUri"

**Actual:** Logger exists (`src/logger.ts`). Logs go to `os.tmpdir()/component-preview-debug.log`. No rotation.

**Fix:** Update to reflect current behavior: logger exists, logs to temp dir, no rotation.

---

### 4. VISION.md — imageServer.ts

**Lines 160, 259:** References `imageServer.ts` as existing or ready to use.

**Actual:** `imageServer.ts` was removed. Extension uses base64 data URIs only.

**Fix:** Remove or qualify references; e.g. "if image server is ever re-added" or delete the imageServer mention.

---

### 5. docs/architecture-rendering-strategy.md — React element lookup

**Line 46:** `find element by _debugSource`

**Actual:** React 19 dropped `_debugSource`. We use `data-src-line` from the jsxDEV route intercept.

**Fix:** Change to: `find element by data-src-line (injected via jsxDEV intercept)`.

---

### 6. docs/architecture-rendering-strategy.md — next.config.js

**Line 91:** "Check next.config.js for custom port"

**Actual:** `devServerDetector.ts` does not read `next.config.js`. Detection order: .env → vite.config → package.json → common ports → VS Code setting.

**Fix:** Remove the next.config.js step or add it to the implementation.

---

### 7. docs/element-identity.md — Cache key and React identity

**Line 12:** "Cache key is uri|version|offset"

**Lines 32–34, 55:** References `_debugSource` for React identity.

**Actual:** Static HTML cache key is `uri\x00elementId` (elementId from id/data-testid/data-component/CSS path). React cache key is `uri\x00line:col`. React 19 uses `data-src-line`, not `_debugSource`.

**Fix:** Update cache key description and React identity strategy to match current implementation.

---

## Medium priority (typos, incomplete lists)

### 8. packages/vite-plugin-component-preview/README.md — Typo

**Line 39:** `// 🚨 DO BLINDLY COPY/PASTE THIS EXAMPLE`

**Likely intent:** `DON'T BLINDLY COPY/PASTE` (warning against blind copy-paste).

**Fix:** Change to `DON'T` or rephrase.

---

### 9. CLAUDE.md — Current docs list

**Line 14:** Lists 7 docs. Missing: `hover-preview-validation-plan.md`, `vite-plugin-refactor-plan.md`, `smoke-test-log.md`, `framework-support-strategy.md`, `new-plan-03-03T08:11.md`.

**Fix:** Add missing docs or mark the list as "key docs" rather than exhaustive.

---

### 10. CLAUDE.md — Dev server ports

**Line 43:** "Scans common ports (3000, 5173, 8080, …)"

**Actual:** `CANDIDATE_PORTS = [5173, 3000, 4173, 8080, 8000]` — 4173 and 8000 are also scanned.

**Fix:** Update to: "Scans common ports (5173, 3000, 4173, 8080, 8000)" or similar.

---

## Low priority (aspirational or historical)

### 11. VISION.md — Zod and axios

**Lines 121, 224:** "Validate all external input with Zod"; Technology table lists `zod` and `axios`.

**Actual:** Extension does not use Zod or axios. Fixtures have Zod only as transitive deps.

**Fix:** Either add Zod/axios or mark as "recommended / future" rather than current.

---

### 12. .claude/skills/inspect-fibers/SKILL.md — Paths

**Line 12:** Uses `cd /workspaces/component-preview` (DevContainer path).

**Line 19:** "Screenshot saved to /tmp/inspect-fibers-$ARGUMENTS.jpeg"

**Actual:** `inspect-fibers.ts` line 405 hardcodes `/tmp/` — fails on Windows. Skill assumes DevContainer.

**Fix:** Document DevContainer assumption, or make inspect-fibers use `os.tmpdir()` for the screenshot path.

---

### 13. docs/plan-milestone-1.md — Historical

References `imageServer.ts`, `uri|version|offset`, PNG serving. Implementation has moved to base64 JPEG, different cache keys, no image server.

**Fix:** Add a header: "Historical plan — implementation has diverged; see CLAUDE.md for current architecture."

---

## Summary

| Severity | Count | Action |
|----------|-------|--------|
| High     | 7     | Update to match implementation |
| Medium   | 3     | Fix typos, complete lists     |
| Low      | 3     | Clarify or mark as aspirational |

**Recommended order:** Fix high-priority items first (CLAUDE, VISION, architecture-rendering-strategy, element-identity), then medium (README typo, docs list, ports), then low (Zod/axios, inspect-fibers paths, plan-milestone-1).
