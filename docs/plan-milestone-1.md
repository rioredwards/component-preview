Plan: HTML Element Preview on Hover

Context

Build a VS Code hover provider that, when the user hovers over an HTML element in a .html file, renders that
element headlessly via Playwright and shows a screenshot in the hover tooltip. The three moving pieces are: HTML
annotation (find the node + inject an ID), a Playwright renderer (singleton browser, screenshot by ID), and an
image HTTP server (VS Code hover markdown can't load file:// URIs reliably, so we serve PNGs over
http://127.0.0.1).

Files to Create/Modify

┌──────────────────────┬──────────────────────────────────────────────────────────────────────────────────────┐
│ File │ Action │
├──────────────────────┼──────────────────────────────────────────────────────────────────────────────────────┤
│ package.json │ Add playwright + node-html-parser deps; add "onLanguage:html" activationEvent │
├──────────────────────┼──────────────────────────────────────────────────────────────────────────────────────┤
│ esbuild.js │ Add 'playwright' to external (has native binaries, cannot be bundled) │
├──────────────────────┼──────────────────────────────────────────────────────────────────────────────────────┤
│ src/extension.ts │ Replace: create previewDir, start image server, register HoverProvider, wire up │
│ │ cleanup │
├──────────────────────┼──────────────────────────────────────────────────────────────────────────────────────┤
│ src/imageServer.ts │ Create: tiny http.createServer on random port serving PNGs from previewDir │
├──────────────────────┼──────────────────────────────────────────────────────────────────────────────────────┤
│ src/htmlAnnotator.ts │ Create: annotateHtml(text, offset) using node-html-parser, returns { html, hoverId } │
├──────────────────────┼──────────────────────────────────────────────────────────────────────────────────────┤
│ src/renderer.ts │ Create: Playwright singleton browser + renderElement() + disposeRenderer() │
├──────────────────────┼──────────────────────────────────────────────────────────────────────────────────────┤
│ src/hoverProvider.ts │ Create: HtmlHoverProvider with Map cache keyed on `uri │
└──────────────────────┴──────────────────────────────────────────────────────────────────────────────────────┘

Implementation Steps

1.  Install dependencies

pnpm add playwright node-html-parser
pnpm approve-builds # allow playwright/esbuild postinstall scripts
pnpm install
npx playwright install chromium

2.  Update esbuild.js

Add 'playwright' to the external array (line 38):
external: ['vscode', 'playwright'],
node-html-parser is pure JS and can be bundled.

3.  Update package.json

- Add "onLanguage:html" to activationEvents
- Add dependencies block with playwright and node-html-parser
- Remove boilerplate helloWorld command from contributes

4.  Create src/imageServer.ts

export interface ImageServer { port: number; url(filename: string): string; dispose(): void; }
export function startImageServer(serveDir: string): Promise<ImageServer>

- http.createServer on port 0 (OS assigns), bound to 127.0.0.1
- Serves only .png files; uses path.basename to prevent path traversal
- Cache-Control: no-store so hover always shows fresh screenshot

5.  Create src/htmlAnnotator.ts

export function annotateHtml(htmlText: string, offset: number): { html: string; hoverId: string } | null

- parse(htmlText) with node-html-parser
- Walk tree depth-first; return deepest HTMLElement whose range contains offset
- Guard: skip root node (no tagName), skip non-element nodes
- Generate hoverId = randomUUID()
- Find the > closing the open tag by walking forward from node.range[0] (handles quoted attrs with > inside)
- Splice data-hover-id="${hoverId}" before that >

6.  Create src/renderer.ts

export async function renderElement(opts: RenderOptions): Promise<void>
export async function disposeRenderer(): Promise<void>

- Singleton: let browserInstance: Browser | null; lazy-init via chromium.launch({ headless: true })
- Per-render: ctx.newPage(), page.goto('file://<tmpFile>', { waitUntil: 'networkidle' })
- page.locator('[data-hover-id="<id>"]').waitFor({ state: 'visible', timeout: 5000 })
- locator.screenshot({ path: outputPath, animations: 'disabled' })
- Always page.close() in finally; temp HTML file written to os.tmpdir()
- disposeRenderer() closes context + browser, nulls both singletons

7.  Create src/hoverProvider.ts

export class HtmlHoverProvider implements vscode.HoverProvider

- Cache: Map<string, { hover: vscode.Hover; timestamp: number }>, max 50 entries, 5-min TTL
- provideHover(document, position, token):
  a. offset = document.offsetAt(position)
  b. Cache key: "${uri}|${version}|${offset}"; return cached if hit
  c. annotateHtml(document.getText(), offset) - return null if no element
  d. Check token.isCancellationRequested before render
  e. renderElement(...) - return null on error (log to console)
  f. Check cancellation again after render
  g. Build MarkdownString with <img src="http://127.0.0.1:<port>/<id>.png">, set supportHtml = true and isTrusted
  = true
  h. Cache and return new vscode.Hover(md)

8.  Replace src/extension.ts

export async function activate(context: vscode.ExtensionContext): Promise<void>

- Create previewDir = path.join(context.globalStorageUri.fsPath, 'previews'); fs.mkdir recursive
- startImageServer(previewDir) - show error message and return on failure
- vscode.languages.registerHoverProvider({ language: 'html', scheme: 'file' }, provider)
- Push a single disposable to context.subscriptions that: closes image server, fires disposeRenderer(), deletes
  previewDir

Key Gotchas

- supportHtml + isTrusted: Both are required on MarkdownString for <img src="http://..."> to render
- pnpm build scripts: pnpm may block playwright's postinstall; run pnpm approve-builds first
- root node guard: node-html-parser's root from parse() has tagName = null; must skip it
- async activate: Fine since @types/vscode ^1.109.0; returns Promise<void>
- concurrent hovers: Each hover gets a unique UUID, so no PNG filename collision

Implementation Order

1.  package.json + esbuild.js (so install works)
2.  Run install commands
3.  imageServer.ts (no cross-deps)
4.  htmlAnnotator.ts (no cross-deps)
5.  renderer.ts (no cross-deps)
6.  hoverProvider.ts (imports the above)
7.  extension.ts (imports hoverProvider, imageServer, renderer)
8.  pnpm run compile to catch type errors

Verification

1.  Press F5 to open Extension Development Host
2.  Create/open a test.html file with some elements (e.g. <button>Click me</button>)
3.  Hover over the button tag
4.  Hover tooltip should show a rendered PNG of the button
5.  Move cursor away and back; second hover should return instantly (cached)
6.  Edit the file; cache should miss and re-render
