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

- [P1] Fallback hover on composite React components should capture full rendered output (not first host child)
  - Acceptance criteria:
    - Hovering component declarations/usages for fragment-returning components captures the full component output (or a clearly better container) rather than a single child node (e.g., logo image block).
    - Works in Vite React JS and TS fixtures without vite-plugin-component-preview enabled.
    - Includes regression tests for current TS fixture scenario.
  - Dependencies:
    - None required for initial heuristic implementation.
  - Notes:
    - Current behavior is acceptable for beta V1 but should be improved in a near-term follow-up.
