# Plan: Stable XPath-Based Element Identity

Replaces the fragile `uri|version|offset` cache key with a stable structural
identity derived from the element's position in the HTML parse tree.

---

## The Problem

The current cache key is `uri|version|offset`:
- `version` increments on every keystroke → constant cache misses
- `offset` shifts whenever anything above it is edited
- Makes durable image attachment impossible (free-tier feature prerequisite)

---

## Design Decisions

### New cache key: `uri\x00elementId`

`elementId` is derived from the parse tree, not the cursor. `version` and `offset`
are dropped entirely. Null byte `\x00` is the separator — it cannot appear in HTML
attribute values, making key collisions impossible.

### Priority chain for `elementId`

Check in order, use first match:
1. `id` attribute → `#hero-section`
2. `data-testid` → `[data-testid="submit-btn"]`
3. `data-component` → `[data-component="Hero"]`
4. Structural path fallback → `html > body > main > section:nth-of-type(2) > h1`

Structural path uses CSS-selector style. `:nth-of-type(n)` is only appended when
there are multiple same-tag siblings (omitted when unambiguous, keeping keys short).

### Where identity generation lives

In `htmlAnnotator.ts` — it already owns the parse step and has the `HTMLElement`
node in hand. Keeps all tree-walking in one place.

### Cache check moves after `annotateHtml`

`elementId` is only available after parsing, so `provideHover` restructures to:
1. Parse → get `annotated` (or return null)
2. Build `cacheKey` from `annotated.elementId`
3. Check cache → return if hit
4. Render (unchanged)

Every hover now incurs a parse even on a cache hit. Acceptable: `node-html-parser`
is synchronous and fast (~1ms for a typical file); Playwright renders (~100–500ms)
dominate latency.

---

## File Changes

| File | Change |
|---|---|
| `src/htmlAnnotator.ts` | Add `AnnotateResult` interface; add `elementIdentityFromNode`; update return type |
| `src/hoverProvider.ts` | Restructure `provideHover`; replace cache key construction |
| `src/renderer.ts` | No changes |
| `src/extension.ts` | No changes |

---

## Implementation

### `src/htmlAnnotator.ts`

**New interface (exported):**
```typescript
export interface AnnotateResult {
  html: string;       // HTML with data-hover-id injected (unchanged)
  hoverId: string;    // UUID for Playwright locator (unchanged)
  elementId: string;  // stable structural identity (new)
}
```

**New private function:**
```typescript
const STABLE_ATTRS = ['id', 'data-testid', 'data-component'] as const;

function elementIdentityFromNode(element: HTMLElement): string {
  // Priority chain: stable attributes first
  for (const attr of STABLE_ATTRS) {
    const val = element.getAttribute(attr)?.trim();
    if (val && !val.includes('"')) {
      return attr === 'id' ? `#${val}` : `[${attr}="${val}"]`;
    }
  }

  // Structural path fallback
  const segments: string[] = [];
  let current: HTMLElement = element;

  while (current.tagName) {
    const tag = current.tagName.toLowerCase();
    const parent = current.parentNode as HTMLElement | undefined;
    let segment = tag;

    if (parent?.tagName) {
      const siblings = parent.children.filter(
        (c) => c.tagName?.toLowerCase() === tag
      );
      if (siblings.length > 1) {
        const idx = siblings.indexOf(current) + 1; // 1-based
        segment = `${tag}:nth-of-type(${idx})`;
      }
    }

    segments.unshift(segment);
    current = current.parentNode as HTMLElement;
  }

  return segments.join(' > ');
}
```

**Updated `annotateHtml` signature:**
```typescript
export function annotateHtml(
  htmlText: string,
  offset: number
): AnnotateResult | null
```

Compute `elementId = elementIdentityFromNode(element)` immediately after
`findDeepestAtOffset`. Return `{ html, hoverId, elementId }`. Tag-injection
logic is unchanged.

---

### `src/hoverProvider.ts`

**Replace `provideHover` structure:**
```typescript
async provideHover(document, position, token) {
  const offset = document.offsetAt(position);

  // Parse first — elementId is only available after this
  const annotated = annotateHtml(document.getText(), offset);
  if (!annotated) return null;

  // Stable key: no version, no offset
  const cacheKey = `${document.uri}\x00${annotated.elementId}`;

  const cached = this.cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.hover;
  }

  if (token.isCancellationRequested) return null;

  // ... render logic unchanged ...
}
```

---

## Edge Cases

| Case | Behaviour |
|---|---|
| Duplicate `id` attributes | Cache key collides — known HTML authoring error, not our bug to fix |
| Whitespace-only edits | Tree structure unchanged → key stable ✓ |
| Same-tag siblings | `:nth-of-type(n)` makes them distinct ✓ |
| Deeply nested elements | Long key string, no performance impact on Map ops ✓ |
| `data-testid` with `"` in value | Falls through to structural path (one-liner guard) |
| File renamed | `uri` changes → full cache miss, correct ✓ |
| Void elements (`<br>`, `<img>`) | Valid sibling list members, handled correctly ✓ |
| Root node (`tagName = null`) | `while (current.tagName)` exits naturally ✓ |

---

## Foundation for Durable Image Attachment

Once `elementId` is stable, a sidecar file `.component-previews.json` can map:
```json
{ "html > body > section#hero > h1": { "imagePath": "...", "capturedAt": "..." } }
```
The sidecar can be committed to git so teammates share manually-attached previews.
This is out of scope here but `elementId` is the required prerequisite.
