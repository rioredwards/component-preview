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

- [P1] Fallback hover on composite React components should capture full rendered output (not first host child)
  - Acceptance criteria:
    - Hovering component declarations/usages for fragment-returning components captures the full component output (or a clearly better container) rather than a single child node (e.g., logo image block).
    - Works in Vite React JS and TS fixtures without vite-plugin-component-preview enabled.
    - Includes regression tests for current TS fixture scenario.
  - Dependencies:
    - None required for initial heuristic implementation.
  - Notes:
    - Current behavior is acceptable for beta V1 but should be improved in a near-term follow-up.
