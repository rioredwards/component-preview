# BACKLOG

Flat, priority-ordered ticket list.

## Priority rubric

- **P0 — Release blocker / broken core path**
  - Core user flow is broken, data loss risk, or extension effectively unusable for target scenario.
  - Fix immediately before other planned work.

- **P1 — High impact, not a hard blocker**
  - Core flow works but behavior is frequently wrong/confusing, or quality is below beta expectations.
  - Prioritize in the next focused batch.

- **P2 — Important polish / secondary flows**
  - Noticeable rough edges, weaker UX, or narrower bugs with clear workarounds.
  - Schedule after P0/P1 are under control.

- **P3 — Nice-to-have / future optimization**
  - Enhancements, optional ergonomics, low-frequency edge cases.
  - Do opportunistically.

## Ticket format

- `[P0|P1|P2|P3] <title>`
  - Acceptance criteria:
  - Dependencies:
  - Notes:

---

- [P1] AI-first setup and troubleshooting prompts (README + error UX)
  - Acceptance criteria:
    - README includes a copy-paste "AI setup prompt" near the top that guides an AI agent to install and configure component-preview in an existing repo.
    - README includes a copy-paste "AI troubleshooting prompt" for common failures (dev server mismatch, plugin missing, no adapter detected).
    - Hover error surfaces include an "AI help" affordance (or equivalent) that provides a context-rich prompt users can copy quickly.
    - Prompt text includes key diagnostics automatically when possible (workspace file, hovered file/line, detected dev server URL, last error message, framework hints).
    - Prompts are concise, deterministic, and safe (no secret exfiltration instructions).
  - Dependencies:
    - Minimal UX decision for how prompts are exposed (link/button/command palette action).
  - Notes:
    - Intended as a high-leverage beta usability win, especially for AI-native users.

- [P0] Svelte plugin transform must ignore style/script virtual modules (currently breaks Vite dev server)
  - Acceptance criteria:
    - `vite-plugin-component-preview` does not run Svelte markup transform on virtual module ids like `App.svelte?svelte&type=style...` or other non-markup sub-requests.
    - Running the Vite Svelte fixture with plugin enabled does not throw parser errors such as `Expected token }` from CSS style blocks.
    - Add regression test covering a style virtual-module id.
  - Dependencies:
    - Adjust transform id filtering in plugin entrypoint.
  - Notes:
    - Observed error: plugin attempted Svelte parse on CSS payload from `?type=style` request.

- [P1] Svelte hover should work without requiring separate Svelte VS Code tooling (or show explicit guidance)
  - Acceptance criteria:
    - In a plain VS Code setup (component-preview installed, no extra Svelte extensions), hovering in `*.svelte` files still triggers component-preview behavior.
    - If technical constraints require external Svelte tooling, show an explicit hover/notification explaining exactly what is missing and how to install it.
    - Add docs note in README setup/troubleshooting for Svelte expectations.
  - Dependencies:
    - Decide whether to support pattern-based registration for `*.svelte` files or keep language-id registration and add guided onboarding.
  - Notes:
    - Reported during manual smoke tests as "no hover shown" in a Vite Svelte JS fixture.

- [P2] UX polish: onboarding toast for missing plugin/framework support
  - Acceptance criteria:
    - Show a clear, low-noise onboarding toast when plugin-required frameworks are detected without setup.
    - Toast includes direct action(s): open setup docs / open plugin page.
    - Avoid repeat spam via dismissal TTL or session-level suppression.
  - Dependencies:
    - Reuse existing plugin onboarding notification paths.
  - Notes:
    - Requested as part of beta UX polish checklist.

- [P2] UX polish: improve dev server error copy
  - Acceptance criteria:
    - Error hovers/notifications explain likely causes in plain language (wrong app URL, server down, plugin missing, route mismatch).
    - Include concrete next actions and command/settings hints.
    - Keep copy concise and readable in hover window.
  - Dependencies:
    - None.
  - Notes:
    - Requested as part of beta UX polish checklist.

- [P2] UX polish: add "Component Preview: Diagnose Setup" command
  - Acceptance criteria:
    - New command runs a lightweight local diagnosis (workspace file type, detected dev server, configured override, plugin marker presence when applicable).
    - Returns actionable summary with pass/fail checks and next steps.
    - Can be linked from error hovers/notifications.
  - Dependencies:
    - May reuse existing detection logic (`detectDevServer`, plugin marker checks).
  - Notes:
    - Requested as part of beta UX polish checklist.

- [P1] Manage persistent preview-image storage (discoverability + cleanup controls)
  - Acceptance criteria:
    - Add a command to open the persistent image folder in Finder/Explorer.
    - Add a command to clear persistent copied preview images.
    - Add a status command that reports image count + total folder size in human-readable units.
    - Add automatic retention policy for persistent copied previews (e.g., max age and/or max bytes) to prevent unbounded growth.
    - Document where images are stored and how users can manage them.
  - Dependencies:
    - Decide retention defaults and whether to expose settings.
  - Notes:
    - Current copied-preview persistence can grow indefinitely over long-term use without visibility.

- [P1] Hover markdown regression: divider formatting can cause preview image HTML to render as raw text
  - Acceptance criteria:
    - Preview hover consistently renders the actual image (not raw `<img ...>` text) across supported editor themes and markdown settings.
    - Visual separation between header/content is preserved without breaking HTML image rendering.
    - Add regression test/fixture coverage for branded header + divider + image block markdown composition.
  - Dependencies:
    - Revisit hover markdown composition strategy (horizontal rule vs alternative separator).
  - Notes:
    - Observed in the current `hover-fixture-debug-vite-react-js` fixture at a specific hover location: image did not render and the `<img ... src="data:image/...;base64,...">` markup appeared as plain text.
    - Likely tied to markdown/hover composition and effective payload length in that context, not the intrinsic element type itself.

- [P2] Add privacy mode to disable all persistent preview-image storage
  - Acceptance criteria:
    - New setting disables writing persistent preview images (copy-path flow should keep temporary behavior only or require explicit save).
    - Clear UX copy explains tradeoff (copied temp paths may expire).
    - Default remains current behavior unless product decision changes.
  - Dependencies:
    - Decide default value and migration behavior.
  - Notes:
    - Requested for NDA-sensitive workflows.

- [P2] AI handoff helper: copy preview + code context prompt from hover
  - Acceptance criteria:
    - Add a hover action/command that assembles an AI-ready prompt in clipboard.
    - Prompt includes: preview image file path, current file path, hovered line/column, and a bounded code snippet around the hover location.
    - Prompt template is user-facing, concise, and editable via settings or a configurable template string.
    - Include privacy guardrails (avoid auto-including entire files; keep snippet size bounded).
    - Works for HTML/React/Vue/Svelte hover flows.
  - Dependencies:
    - Reuse existing hover context and copy-preview-path plumbing.
  - Notes:
    - Goal: one-click handoff to AI chats with both visual and code context.

- [P3] Build tooling cleanup: evaluate migration of vite-plugin build pipeline to `tsup`
  - Acceptance criteria:
    - Compare current `tsc + minify script` flow vs `tsup` for simplicity, output quality, and publish artifact control.
    - If migration is adopted, preserve current release guarantees: minified JS, no published sourcemaps, declaration output retained.
    - Update plugin build docs/scripts and verify with `npm test`, `npm run build`, `npm pack --dry-run`.
  - Dependencies:
    - Post-release cleanup window (do not block beta publish).
  - Notes:
    - Nice-to-have maintainability improvement; current pipeline is sufficient for release.

- [P1] Fallback hover on composite React components should capture full rendered output (not first host child)
  - Acceptance criteria:
    - Hovering component declarations/usages for fragment-returning components captures the full component output (or a clearly better container) rather than a single child node (e.g., logo image block).
    - Works in Vite React JS and TS fixtures without vite-plugin-component-preview enabled.
    - Includes regression tests for current TS fixture scenario.
  - Dependencies:
    - None required for initial heuristic implementation.
  - Notes:
    - Current behavior is acceptable for beta V1 but should be improved in a near-term follow-up.
