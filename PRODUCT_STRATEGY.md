# Product Strategy Notes (March 2026)

A quick reference so launch and monetization decisions stay consistent.

## Core thesis

- The moat is not the raw idea; it is execution speed, reliability, UX quality, and distribution.
- Ship early with a strong core loop and learn from real usage.

## Release strategy

- Do not wait for a large feature set before launch.
- Launch once the core loop is solid:
  - reliable hover preview rendering
  - at least one high-value action workflow (PR export now exists)
  - clear setup docs and demo assets

## Product structure

- **Free core should stay valuable**:
  - local hover previews
  - basic save/export actions
- **Pro should focus on leverage features**:
  - batch captures
  - snapshot history/search
  - visual compare/diff
  - team/cloud sharing
  - AI workflow helpers

## Monetization guidance

- Prefer freemium over early hard paywall.
- Avoid watermarking free screenshots in early stage (likely harms trust/adoption).
- Add Pro only after signs of pull from active users.
- Keep optional support links (Buy Me a Coffee/sponsorship) as secondary, not primary model.

## Open source stance (current)

- Keep core product closed-source for now.
- Consider open-sourcing selective non-core pieces later if useful for trust/community.

## Near-term rollout (4–6 weeks)

1. Launch polished MVP now.
2. Share short demos/screenshots in dev channels.
3. Add lightweight feedback collection and Pro waitlist signal.
4. Track activation and retention metrics:
   - install -> first successful preview
   - first export action
   - weekly active retained users
5. Use those signals to prioritize the first Pro slice.

## Positioning line

- **Free:** understand UI instantly in-editor.
- **Pro:** ship visual changes faster with team-grade snapshot workflows.

## Architecture direction for roadmap

- Keep base hover path simple and fast.
- Build toward a snapshot lifecycle service: capture -> label -> persist -> index -> export.
- Start local-first (manifest/index + files), move to SQLite only when query/scale needs justify it.
