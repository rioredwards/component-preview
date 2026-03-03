# Dev Container Extension Debugging — Lessons Learned

Issues and fixes encountered getting the `component-preview` VS Code extension running inside a dev container.

## 1. Extension Development Host must target the container

When working inside a dev container, pressing F5 must launch the Extension Development Host **within the container**, not on the local machine. In VS Code, use the "Run Extension (Remote)" configuration, or ensure the launch target is set to the remote/container environment. If the EDH launches locally, it won't find the extension's files and `activate()` will never be called.

## 2. Background `preLaunchTask` blocks the extension host from launching

The default scaffolded `launch.json` uses `"preLaunchTask": "${defaultBuildTask}"`, which resolves to the `watch` task. Watch tasks are background tasks that never "complete" — VS Code waits for them to finish before launching the extension host, so the host never starts.

**Fix:** Replace it with a one-shot `compile` task:

```json
// .vscode/tasks.json
{
  "label": "compile",
  "type": "npm",
  "script": "compile",
  "group": { "kind": "build", "isDefault": true },
  "problemMatcher": [],
  "presentation": { "reveal": "silent" }
}
```

```json
// .vscode/launch.json
"preLaunchTask": "compile"
```

Using `"problemMatcher": []` is important — it tells VS Code the task is done when the process exits, rather than waiting for a specific output pattern that may never appear.

## 3. Playwright's Chromium browser must be installed manually

After `pnpm install`, Playwright downloads its package but not the browser binary. You must run:

```sh
npx playwright install chromium
sudo npx playwright install-deps chromium
```

The second command installs OS-level graphics libraries (libatk, libnss3, libgbm1, etc.) that headless Chromium requires on Debian/Ubuntu. Add both to `.devcontainer/postcreate.sh` so future container rebuilds have Chromium automatically.

## 4. VS Code hover tooltips block `http://` image URLs (even with `isTrusted`)

VS Code's hover tooltip webview enforces a Content Security Policy that blocks external `http://` requests — including `http://127.0.0.1` — even when `MarkdownString.isTrusted = true` and `MarkdownString.supportHtml = true`. The image tag renders but the browser never makes the request, showing a broken image icon.

**Fix:** Embed the PNG as a base64 data URI instead of serving it over HTTP:

```typescript
const base64 = fs.readFileSync(outputPath).toString('base64');
const md = new vscode.MarkdownString(`<img src="data:image/png;base64,${base64}">`);
md.supportHtml = true;
md.isTrusted = true;
```

This eliminates the need for an HTTP image server entirely. The image bytes are inlined in the HTML string, so no network request is made and CSP is not a factor.
