# Hover Preview Validation Plan

## Current automated verification

The extension-host demo test currently verifies:

1. Hover provider returns a hover for a TSX position.
2. Hover markdown contains an embedded base64 image (`data:image/...;base64,...`).
3. Diagnostic path returns a clear hover message when no matching target can be rendered.
4. Hover command metadata includes target identity assertions:
   - matched adapter name
   - matched element tag/id/class
   - matched source file/line/column

This proves the pipeline can detect, render, capture, and return an image.

## What it does not verify yet

It does not prove the screenshot is the correct component when multiple valid candidates exist.

Specifically, it does not currently assert:

- expected image geometry
- expected visual content beyond "an image exists"

## Next improvements

### Phase 2: target identity assertions (complete)

Implemented in extension-host tests by parsing hover command payload metadata.

Then assert those values in extension-host tests.

### Phase 3: image correctness assertions

Create deterministic fixtures with intentionally distinct target candidates:

- different sizes
- different background colors
- unique text labels

In tests, decode the returned image and assert:

- dimensions are within expected range
- optional perceptual hash or checksum matches baseline within tolerance

### Phase 4: route and workspace correctness

Add multi-server integration tests:

- fixture app A on port 5173
- unrelated app B on port 3000

Assert workspace-scoped detection always binds to fixture A unless explicit override is set.

## Fixture source of truth

Use `fixtures/hover-fixture-debug` as the canonical local app for manual reproduction and CI-friendly integration tests.
