# component-preview — Project Vision & Engineering Manifesto

This file is the authoritative source for the product vision, technical roadmap, engineering
values, and development workflow for `component-preview`. It is intentionally written to be
useful context for both human contributors and AI assistants.

---

## What This Is

A VS Code extension that renders live previews of HTML/component code directly in the hover
tooltip. The goal is to make frontend development dramatically faster by giving developers an
instant, accurate visual of any element without leaving the editor or running a dev server.

This is intended to become a commercial product:
- **Free tier** — core preview functionality, broadly useful out of the box
- **Pro tier** — advanced features requiring infrastructure (see Product Tiers below)

---

## Rendering Architecture

The extension uses **two different rendering paths** depending on project type. See
`docs/architecture-rendering-strategy.md` for full rationale and technical detail.

| Project type | Rendering path |
|---|---|
| Static `.html` files | Playwright renders a local temp file; stylesheets are inlined |
| React / Vue / framework apps | Playwright pointed at the user's **running dev server** |

The dev server path avoids rebuilding the user's build system. Developers working on a React/Vue
app are almost always running a dev server anyway — requiring it is not a meaningful friction.
The Chrome DevTools Protocol companion extension is a future option, not current scope.

---

## Feature Roadmap

Milestones are ordered by dependency and complexity. Each should be treated as a shippable
increment — don't start the next until the current is solid.

### Milestone 1 — Plain HTML (✅ Done)
- Hover over any element in a `.html` file
- Playwright renders it headlessly, screenshot appears in tooltip
- 50-entry / 5-min TTL cache keyed on `uri|version|offset`
- JPEG embedded as base64 data URI (bypasses VS Code CSP)

### Milestone 2 — External Stylesheets (static HTML path) (✅ Done)
- Detect `<link rel="stylesheet">` tags in the document
- Resolve relative paths to absolute file paths
- Inline stylesheets as `<style>` blocks before writing the temp file
- Handle one level of `@import` chains
- See `docs/plan-milestone-2.md`

### Milestone 3 — React + Dev Server (✅ Done)
The pivot away from reimplementing the build system. See `docs/architecture-rendering-strategy.md`
and `docs/react-fiber-internals.md`.
- Detect a running dev server (scan common ports, read `.env` / `vite.config`)
- Navigate Playwright to the dev server root (persistent page, reused across hovers)
- Walk the fiber tree directly via `__reactContainer$` on the root DOM element
- Recover Babel-computed source line numbers by route-intercepting `react_jsx-dev-runtime.js`
  and wrapping `jsxDEV` to inject `data-src-line` props — React 19 dropped `_debugSource`
- Score all matching fibers by proximity to hovered line; screenshot best-match DOM node
- Cache key: `uri\x00line:col`

### Milestone 4 — Vue + Other Frameworks
- Same dev server approach as M3
- Vue DevTools exposes a similar component tree via `window.__VUE_DEVTOOLS_GLOBAL_HOOK__`
- Svelte: investigate equivalent debug hooks

### Milestone 5 — CSS Variants (static HTML path only, deferred)
Only relevant for projects without a dev server (plain `.html` files with Tailwind / SCSS).
Deprioritized until M3 and M4 are proven.
- Detect CSS preprocessor/framework via `package.json` / config files
- **Tailwind**: lightweight JIT pass over the element's class list before rendering
- **SCSS/Less**: compile source stylesheet to CSS before injecting

### Milestone 6 — Pro Infrastructure
- Cloud-based rendering (offload Playwright from the user's machine)
- Review links (shareable URLs for rendered previews)
- CI/CD integration (auto-screenshot components in PRs)
- Companion Chrome extension (richer element identity, live state, two-way navigation)

---

## Product Tiers

### Free
- All local rendering features (Milestones 1–5)
- Unlimited usage, no account required
- Open core

### Pro (requires account + subscription)
- **Diff views** — side-by-side before/after when you edit a component
- **AI integration** — ask questions about the rendered output, get suggestions
- **PR screenshots** — automatically attach component previews to pull requests
- **CI integration** — generate previews in GitHub Actions / GitLab CI pipelines
- **Review links** — shareable cloud-hosted preview URLs
- **Cloud rendering** — render on Anthropic/cloud infra instead of the user's machine
- **Cloud storage** — persist and browse historical renders
- **Browser extension** — companion app for viewing previews in the browser

---

## Engineering Values

### Correctness & Reliability First
- Handle errors explicitly. Never swallow exceptions silently.
- Validate all external input with **Zod** (file content, config files, API responses).
- Write defensive code at system boundaries; trust internal contracts.
- Edge cases are not afterthoughts — enumerate them before implementation.

### Performance is a Feature
- This extension runs Playwright (a heavy process). Every decision must account for that.
- Lazy-initialize everything. The browser should not launch until the first hover.
- Cache aggressively. Re-renders should only happen when genuinely needed.
- Profile before optimizing. Don't speculate about bottlenecks.
- Measure extension activation time and hover-to-preview latency; keep them bounded.

### Readability & Maintainability
- Code is read far more than it is written. Optimize for reading.
- Each module has one clear responsibility (see architecture in `CLAUDE.md`).
- Use **JSDoc** on all exported functions and classes — parameters, return types, and a
  one-sentence description of the purpose.
- Name things for what they do, not how they do it.
- Prefer explicit over clever. A slightly longer, obvious implementation beats a compact,
  opaque one.

### Testability
- Write code that can be tested in isolation. Inject dependencies; don't hardcode them.
- Pure functions wherever possible (annotator, cache logic, path resolution).
- Integration tests for the render pipeline using known HTML fixtures.
- Aim for tests that catch real bugs, not tests that just assert the code runs.

### DRY Without Premature Abstraction
- Don't abstract until you have three real instances of the same pattern.
- Prefer duplication over a wrong abstraction.
- Shared utilities live in `src/utils/` only when they are genuinely reusable.

### Security
- Never execute arbitrary code from the document without sandboxing.
- Sanitize all file paths to prevent traversal attacks.
- The image server (if ever re-enabled) must only serve from `previewDir`.
- No telemetry or data collection without explicit user consent.

---

## Development Workflow

### Branching Strategy
- `main` — always releasable, protected
- `dev` — integration branch for in-progress milestone work
- `feat/<name>` — individual features or sub-features
- `fix/<name>` — bug fixes
- `chore/<name>` — non-functional changes (deps, config, docs)

### Versioning
- Follow **SemVer**: `MAJOR.MINOR.PATCH`
- MAJOR: breaking changes to the extension API or configuration format
- MINOR: new features (new framework support, new UI)
- PATCH: bug fixes and performance improvements

### Ticket System
- Work is tracked in `BACKLOG.md` as a flat bullet list, ordered by priority.
- Each ticket has: a short title, acceptance criteria, and any known dependencies.
- Move tickets to `plan.md` (the active sprint) when ready to work on them.
- Close tickets with the commit that ships them (reference the ticket in the commit message).

### Commit Style
- Format: `type(scope): short description`
- Types: `feat`, `fix`, `perf`, `refactor`, `test`, `chore`, `docs`
- Example: `feat(renderer): support Tailwind JIT pass before screenshot`
- Keep commits small and focused. One logical change per commit.

### AI-Assisted Development
- AI is a collaborator, not an autocomplete. Use it for design, review, and generation.
- Always review AI-generated code before committing. Understand what it does.
- Keep `CLAUDE.md` and `VISION.md` up to date — they are the AI's long-term memory.
- Use `plan.md` as the active working document for the current milestone.
- When a session produces durable learnings, update `CLAUDE.md` or create a topic file
  in `.claude/memory/`.

### Observability
- Structured logging via a central logger module (to be built in Milestone 2).
- Log levels: `debug`, `info`, `warn`, `error`.
- Errors include: what failed, what inputs caused it, and what the user impact is.
- The VS Code Output channel (`component-preview`) surfaces `info` and above to the user.
- `debug` logs are written to a rotating file in `globalStorageUri` for AI/developer access.
- Goal: AI should be able to diagnose bugs from log output without copy-paste from the user.

---

## Technology Choices

| Concern | Tool | Rationale |
|---|---|---|
| HTML parsing | `node-html-parser` | Pure JS, fast, no native deps |
| Rendering | `playwright` (Chromium) | Industry standard, reliable, headless |
| Bundling | `esbuild` | Fast, simple config, good tree-shaking |
| Type safety | TypeScript strict mode | Catch bugs at compile time |
| Schema validation | `zod` | Runtime safety at all external boundaries |
| HTTP (if needed) | `axios` | Consistent API, good error handling |
| CSS compilation | `sass`, `postcss` | Per-milestone, added when needed |
| JSX compilation | `esbuild` (built-in) | Already in the stack, handles TSX/JSX well |
| Testing | `@vscode/test-cli` + `mocha` | Official VS Code test runner |
| Linting | `eslint` + `typescript-eslint` | Enforces consistent style |

---

## Known Limitations

This section documents confirmed platform/ecosystem constraints that affect design decisions.
Understanding these upfront prevents re-discovering them mid-implementation.

### VS Code `MarkdownString` content length cap (~100,000 chars)
**Status:** Confirmed
**Impact:** High
**Affects:** Milestone 1+ (all hover-based rendering)

VS Code truncates `MarkdownString` content at approximately 100,000 characters. A base64-encoded
PNG easily exceeds this for anything beyond a simple element — a full-page screenshot or a
component with rich CSS can produce a multi-MB PNG whose base64 representation is several times
that limit. When truncated, the raw base64 string renders as text in the tooltip instead of an
image.

**Workarounds to evaluate (in order of preference):**
1. **Resize/compress the screenshot** — render at a lower resolution or cap viewport dimensions;
   convert PNG → JPEG at reduced quality before encoding (JPEG is ~5–10× smaller for photos/UIs)
2. **Crop to element bounds** — Playwright's `locator.screenshot()` already crops to the element,
   but constraining the element's rendered size (via viewport width) reduces output size further
3. **Fallback to a webview panel** — if the base64 string would exceed the limit, open a proper
   `vscode.WebviewPanel` instead of a hover tooltip; webviews can load `vscode-resource:` URIs
   and have no content-length cap
4. **Re-evaluate the HTTP image server** — if VS Code ever relaxes hover tooltip CSP for
   `http://127.0.0.1`, the server in `imageServer.ts` is ready to use and bypasses the size limit

**Recommended near-term fix:** cap screenshot width at ~800px and encode as JPEG at 85% quality
before base64-encoding. This keeps most previews well under the limit without visible quality loss.

---

### VS Code hover tooltip CSP blocks `http://` image URLs
**Status:** Confirmed
**Impact:** High (already worked around)
**Affects:** Image serving strategy

Even with `MarkdownString.isTrusted = true` and `supportHtml = true`, VS Code's hover tooltip
webview enforces a CSP that blocks all `http://` requests including `http://127.0.0.1`. The `<img>`
tag renders but the browser never fetches the URL — only a broken image icon appears.

**Current workaround:** base64 data URIs embedded directly in the `MarkdownString`.
**Long-term alternative:** webview panel (no CSP restriction, no size limit).

---

### Playwright is a heavy dependency for a VS Code extension
**Status:** Known architectural constraint
**Impact:** Medium
**Affects:** Installation size, activation time, memory usage

Playwright bundles a full Chromium binary (~150–300 MB depending on platform). This is unusually
large for a VS Code extension. The browser process also consumes significant RAM when running.

**Mitigations in place:**
- Singleton browser — launched once on first hover, reused across all subsequent renders
- Lazy init — browser does not start at extension activation, only on first hover
- `page.close()` after every render — pages are not pooled

**Future mitigations to consider:**
- Idle timeout — close the browser after N minutes of inactivity, re-launch on next hover
- Cloud rendering (Pro tier) — offload Playwright entirely from the user's machine

---

### `onLanguage:html` activation — extension inactive until an HTML file is opened
**Status:** Known, intentional
**Impact:** Low
**Affects:** Developer experience during testing

The extension only activates when a `.html` file is opened, which is correct for production but
means console output and errors are invisible until that trigger fires. During development,
temporarily set `"activationEvents": ["*"]` in `package.json` to activate on startup.

---

### Dev container: Extension Development Host must target the container
**Status:** Confirmed, documented
**Impact:** High during development only
**Affects:** Local dev setup

See `docs/devcontainer-debugging.md` for the full set of dev container constraints and fixes.

---

## What Success Looks Like

A developer opens any file in any major frontend project — React, Vue, Svelte, Next.js, plain
HTML — hovers over a component or element, and sees an accurate, styled, interactive-state-aware
preview of exactly what that thing looks like in the browser. No configuration. No running a dev
server. No switching windows. Just hover and see.

That is the north star.
