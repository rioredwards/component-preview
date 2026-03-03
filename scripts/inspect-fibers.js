/**
 * Standalone fiber inspector — mirrors the extension's React render path so
 * you can test it directly from Node.js without the EDH cycle.
 *
 * Usage:
 *   node scripts/inspect-fibers.js [line]
 *
 * Examples:
 *   node scripts/inspect-fibers.js          # uses TARGET_LINE below
 *   node scripts/inspect-fibers.js 19       # test line 19
 *   node scripts/inspect-fibers.js 21       # test line 21
 *
 * What it does:
 *   1. Applies the same jsxDEV route intercept as devServerRenderer.ts
 *   2. Navigates to DEV_SERVER and waits for React to render
 *   3. Walks the fiber tree and shows each fiber's data-src-line (Babel source line)
 *   4. Runs the same scoring algorithm as the extension
 *   5. Reports which element would be selected and screenshots it
 */
'use strict';

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const DEV_SERVER   = 'http://localhost:5173';
const TARGET_FILE  = '/home/node/react-app/src/App.jsx';
const TARGET_LINE  = parseInt(process.argv[2] ?? '11', 10);

// Exact same patch as in devServerRenderer.ts
const JSX_DEV_RUNTIME_PATCH = `
;(function () {
  if (typeof require_jsx_dev_runtime === "undefined") { return; }
  var mod = require_jsx_dev_runtime();
  if (!mod || typeof mod.jsxDEV !== "function") { return; }
  var orig = mod.jsxDEV;
  mod.jsxDEV = function (type, config, key, isStatic, source, self) {
    if (source && typeof type === "string" && source.lineNumber != null) {
      config = Object.assign({}, config, { "data-src-line": source.lineNumber });
    }
    return orig(type, config, key, isStatic, source, self);
  };
})();
`;

(async () => {
  const basename = path.basename(TARGET_FILE);
  console.log(`Target: ${TARGET_FILE}:${TARGET_LINE}`);
  console.log(`Basename: ${basename}\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Apply the same route intercept as devServerRenderer.ts
  await page.route('**/react_jsx-dev-runtime.js*', async route => {
    const response = await route.fetch();
    const original = await response.text();
    const headers = Object.fromEntries(
      Object.entries(response.headers()).filter(([k]) => k !== 'content-length'),
    );
    await route.fulfill({ body: original + JSX_DEV_RUNTIME_PATCH, headers });
  });

  console.log('Navigating to', DEV_SERVER, '(with jsxDEV intercept active)');
  await page.goto(DEV_SERVER, { waitUntil: 'networkidle' });
  console.log('Page loaded:', page.url());

  await page.waitForFunction(() => {
    const root = document.getElementById('root') ?? document.body;
    const key = Object.keys(root).find(k => k.startsWith('__reactContainer'));
    if (!key) { return false; }
    const stale = root[key];
    return !!(stale?.stateNode?.current?.child);
  }, { timeout: 10000 });
  console.log('Fiber tree populated\n');

  // ── Run the exact same logic as devServerRenderer.ts ──────────────────────
  const result = await page.evaluate(({ basename, targetLine }) => {
    const rootEl = document.getElementById('root') ?? document.body;
    const key = Object.keys(rootEl).find(k => k.startsWith('__reactContainer'));
    if (!key) { return { error: 'no __reactContainer key' }; }
    const stale = rootEl[key];
    const hostRoot = stale?.stateNode?.current ?? stale;

    function getDomElement(fiber) {
      for (let f = fiber; f; f = f.child) {
        if (f.stateNode instanceof Element) { return f.stateNode; }
      }
      return null;
    }

    function extractDebugLine(fiber) {
      // 1. data-src-line (our jsxDEV intercept — exact Babel source lines)
      const srcLine = fiber.memoizedProps?.['data-src-line'] ?? fiber.pendingProps?.['data-src-line'];
      if (srcLine !== null && srcLine !== undefined) { return Number(srcLine); }
      // 2. _debugSource (React 18)
      const src = fiber._debugSource;
      if (src?.fileName?.includes(basename)) { return src.lineNumber; }
      // 3. _debugStack (React 19 fallback — compiled lines, imprecise)
      const stack = fiber._debugStack?.stack ?? '';
      if (!stack.includes(basename)) { return null; }
      const after = stack.slice(stack.indexOf(basename) + basename.length);
      const m = after.match(/:(\d+):/);
      return m ? parseInt(m[1]) : null;
    }

    function scoreFiber(candidateLine) {
      if (candidateLine === targetLine) { return 0; }
      if (candidateLine < targetLine) { return -(targetLine - candidateLine); }
      return -(candidateLine - targetLine) * 3;
    }

    // Walk fiber tree — collect all + full dump
    const candidates = [];
    const dump = [];

    function walk(fiber, depth) {
      if (!fiber || dump.length > 60) { return; }
      const typeName = typeof fiber.type === 'function' ? (fiber.type.name || '(anon)') : String(fiber.type);
      const srcLine = extractDebugLine(fiber);
      const el = getDomElement(fiber);
      const hasDom = !!el;
      const domTag = el ? el.tagName.toLowerCase() : null;

      dump.push({ depth, typeName, srcLine, hasDom, domTag });

      if (srcLine !== null && hasDom) {
        const rect = el.getBoundingClientRect();
        candidates.push({ srcLine, domTag, score: scoreFiber(srcLine), w: Math.round(rect.width), h: Math.round(rect.height) });
      }

      walk(fiber.child, depth + 1);
      walk(fiber.sibling, depth);
    }
    walk(hostRoot, 0);

    candidates.sort((a, b) => b.score - a.score);

    // Size guard: skip candidates with negligible bounding boxes.
    let winner = null;
    for (const c of candidates) {
      if (c.w > 2 && c.h > 2) { winner = c; break; }
    }
    if (!winner) winner = candidates[0] ?? null;

    return { dump, candidates, winner };
  }, { basename, targetLine: TARGET_LINE });

  if (result.error) {
    console.error('Error:', result.error);
    await browser.close();
    process.exit(1);
  }

  // ── Print fiber dump ───────────────────────────────────────────────────────
  console.log('Fiber tree (data-src-line values):');
  for (const f of result.dump) {
    const indent = '  '.repeat(f.depth);
    const lineStr = f.srcLine != null ? `line=${f.srcLine}` : 'line=?';
    const domStr  = f.hasDom ? `→ <${f.domTag}>` : '(no DOM)';
    console.log(`${indent}${f.typeName}  ${lineStr}  ${domStr}`);
  }

  // ── Print candidates and winner ───────────────────────────────────────────
  console.log(`\nCandidates for line ${TARGET_LINE}:`);
  for (const c of result.candidates) {
    const marker = c === result.winner ? ' ← SELECTED' : '';
    console.log(`  <${c.domTag}>  line=${c.srcLine}  score=${c.score}${marker}`);
  }

  if (!result.winner) {
    console.log('\n✗ No element found — extension would return null');
    await browser.close();
    process.exit(1);
  }

  // ── Screenshot the selected element (same as extension) ───────────────────
  console.log(`\n→ Screenshotting <${result.winner.domTag}> (line=${result.winner.srcLine})`);

  const outPath = `/tmp/inspect-fibers-${TARGET_LINE}.jpeg`;
  const elementHandle = await page.evaluateHandle(({ basename, targetLine }) => {
    const rootEl = document.getElementById('root') ?? document.body;
    const key = Object.keys(rootEl).find(k => k.startsWith('__reactContainer'));
    const stale = rootEl[key];
    const hostRoot = stale?.stateNode?.current ?? stale;

    function getDomElement(fiber) {
      for (let f = fiber; f; f = f.child) {
        if (f.stateNode instanceof Element) { return f.stateNode; }
      }
      return null;
    }
    function extractDebugLine(fiber) {
      const srcLine = fiber.memoizedProps?.['data-src-line'] ?? fiber.pendingProps?.['data-src-line'];
      if (srcLine !== null && srcLine !== undefined) { return Number(srcLine); }
      const src = fiber._debugSource;
      if (src?.fileName?.includes(basename)) { return src.lineNumber; }
      const stack = fiber._debugStack?.stack ?? '';
      if (!stack.includes(basename)) { return null; }
      const after = stack.slice(stack.indexOf(basename) + basename.length);
      const m = after.match(/:(\d+):/);
      return m ? parseInt(m[1]) : null;
    }
    function scoreFiber(line) {
      if (line === targetLine) { return 0; }
      if (line < targetLine) { return -(targetLine - line); }
      return -(line - targetLine) * 3;
    }

    const candidates = [];
    function walk(fiber) {
      if (!fiber) { return; }
      const line = extractDebugLine(fiber);
      if (line !== null) {
        const el = getDomElement(fiber);
        if (el) { candidates.push({ element: el, line }); }
      }
      walk(fiber.child);
      walk(fiber.sibling);
    }
    walk(hostRoot);
    candidates.sort((a, b) => scoreFiber(b.line) - scoreFiber(a.line));
    // Size guard: skip candidates with negligible bounding boxes.
    for (const c of candidates) {
      const r = c.element.getBoundingClientRect();
      if (r.width > 2 && r.height > 2) { return c.element; }
    }
    return candidates[0]?.element ?? null;
  }, { basename, targetLine: TARGET_LINE });

  const el = elementHandle.asElement();
  if (!el) {
    console.log('✗ evaluateHandle returned null');
    await browser.close();
    process.exit(1);
  }

  // Same adaptive pipeline as devServerRenderer.ts: step down JPEG quality,
  // then resize if still too large for VS Code's base64 limit.
  const MAX_BYTES = 67_500;
  const QUALITY_STEPS = [85, 70, 55, 40];

  const box = await el.boundingBox();
  let buf;
  for (const quality of QUALITY_STEPS) {
    buf = await el.screenshot({ type: 'jpeg', quality, animations: 'disabled' });
    console.log(`  quality=${quality} → ${buf.length} bytes${buf.length <= MAX_BYTES ? ' ✓ fits' : ' ✗ too large'}`);
    if (buf.length <= MAX_BYTES) { break; }
  }

  // Resize fallback for oversized elements
  if (buf.length > MAX_BYTES) {
    console.log('  → resizing oversized screenshot...');
    const resizePage = await browser.newPage({ viewport: { width: 820, height: 620 } });
    const b64 = buf.toString('base64');
    await resizePage.setContent(
      '<!DOCTYPE html><html><body style="margin:0;padding:0;overflow:hidden">' +
      '<img src="data:image/jpeg;base64,' + b64 + '" style="max-width:800px;max-height:600px;display:block;object-fit:contain">' +
      '</body></html>'
    );
    const img = resizePage.locator('img');
    await img.waitFor({ state: 'visible', timeout: 5000 });
    buf = await img.screenshot({ type: 'jpeg', quality: QUALITY_STEPS[0], animations: 'disabled' });
    await resizePage.close();
    console.log(`  resized → ${buf.length} bytes ✓`);
  }

  fs.writeFileSync(outPath, buf);
  console.log(`✓ Screenshot saved: ${outPath}`);
  console.log(`  size=${buf.length} bytes  box=${JSON.stringify({ w: Math.round(box.width), h: Math.round(box.height) })}${buf.length <= MAX_BYTES ? '' : ' WARNING: still over limit'}`);

  await browser.close();
})();
