import * as assert from "assert";
import * as fs from "fs/promises";
import * as http from "http";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";

interface HoverMatchMetadata {
  adapter: string;
  element: {
    tag: string;
    id: string | null;
    className: string | null;
    text: string | null;
  };
  source: {
    file: string;
    line: number;
    column: number;
    origin: string;
  };
}

async function ensureExtensionActive(): Promise<void> {
  const ext = vscode.extensions.all.find((candidate) => candidate.packageJSON?.name === "component-preview");
  assert.ok(ext, "component-preview extension not found in extension host");
  if (!ext.isActive) {
    await ext.activate();
  }
}

function hoverToString(hover: vscode.Hover): string {
  const parts = Array.isArray(hover.contents) ? hover.contents : [hover.contents];
  return parts
    .map((part) => {
      if (typeof part === "string") {
        return part;
      }
      if ("value" in part) {
        return part.value;
      }
      return "";
    })
    .join("\n");
}

async function writeFixtureFile(dir: string, rel: string, content: string): Promise<string> {
  const filePath = path.join(dir, rel);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
  return filePath;
}

async function openFileAndHover(filePath: string, position: vscode.Position): Promise<vscode.Hover[]> {
  await ensureExtensionActive();
  const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
  assert.strictEqual(doc.languageId, "typescriptreact");
  await vscode.window.showTextDocument(doc);
  await new Promise((resolve) => setTimeout(resolve, 200));
  const hovers = (await vscode.commands.executeCommand(
    "vscode.executeHoverProvider",
    doc.uri,
    position,
  )) as vscode.Hover[] | undefined;
  return hovers ?? [];
}

async function writeFirstEmbeddedImageFromHoverMarkdown(markdown: string): Promise<string | null> {
  const match = markdown.match(/data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/=]+)/);
  if (!match) {
    return null;
  }

  const mime = match[1];
  const base64 = match[2];
  const ext = mime === "image/png" ? "png" : "jpeg";
  const outputPath = path.join(os.tmpdir(), `component-preview-hover-demo.${ext}`);
  await fs.writeFile(outputPath, Buffer.from(base64, "base64"));
  return outputPath;
}

function isHoverMatchMetadata(value: unknown): value is HoverMatchMetadata {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.adapter !== "string") {
    return false;
  }
  const element = candidate.element as Record<string, unknown> | undefined;
  const source = candidate.source as Record<string, unknown> | undefined;
  if (!element || !source) {
    return false;
  }
  return (
    typeof element.tag === "string" &&
    (typeof element.id === "string" || element.id === null) &&
    (typeof element.className === "string" || element.className === null) &&
    (typeof element.text === "string" || element.text === null) &&
    typeof source.file === "string" &&
    typeof source.line === "number" &&
    typeof source.column === "number" &&
    typeof source.origin === "string"
  );
}

function readAttachCommandMetadata(markdown: string): HoverMatchMetadata | null {
  const prefix = "command:component-preview.attachImage?";
  const start = markdown.indexOf(prefix);
  if (start < 0) {
    return null;
  }

  const argsStart = start + prefix.length;
  const argsTail = markdown.slice(argsStart);
  const closingOffset = argsTail.search(/\)(?=\s|$)/);
  if (closingOffset < 0) {
    return null;
  }
  const encodedArgs = argsTail.slice(0, closingOffset);

  let decoded: string;
  try {
    decoded = decodeURIComponent(encodedArgs);
  } catch {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(decoded);
  } catch {
    return null;
  }

  if (!Array.isArray(parsed) || parsed.length < 3) {
    return null;
  }

  const metadata = parsed[2];
  return isHoverMatchMetadata(metadata) ? metadata : null;
}

suite("Extension Test Suite", () => {
  test("shows a diagnostic hover when no matching preview target is available", async function () {
    this.timeout(15_000);

    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "cp-hover-no-server-"));
    const filePath = await writeFixtureFile(
      tmp,
      "App.tsx",
      [
        "export function App() {",
        "  return <button>Hello</button>;",
        "}",
      ].join("\n"),
    );
    await writeFixtureFile(
      tmp,
      "vite.config.ts",
      "import { defineConfig } from 'vite'; export default defineConfig({});",
    );

    const config = vscode.workspace.getConfiguration("component-preview", vscode.Uri.file(filePath));
    await config.update("devServerUrl", "", vscode.ConfigurationTarget.Global);

    const hovers = await openFileAndHover(filePath, new vscode.Position(1, 10));
    const text = hovers.map(hoverToString).join("\n\n");

    const hasNoServerDiagnostic = text.includes("No matching dev server was detected for this workspace.");
    const hasMismatchDiagnostic = text.includes("The preview could not match this hover target.");
    assert.ok(
      hasNoServerDiagnostic || hasMismatchDiagnostic,
      `Expected no-server or mismatch hover diagnostic, got:\n${text}`,
    );
  });

  test("renders an image hover from a configured local test server", async function () {
    this.timeout(30_000);

    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "cp-hover-image-"));
    const filePath = await writeFixtureFile(
      tmp,
      "App.tsx",
      [
        "export function App() {",
        "  return <main>App</main>;",
        "}",
      ].join("\n"),
    );

    const server = http.createServer((req, res) => {
      if (!req.url || req.url === "/") {
        res.writeHead(200, { "content-type": "text/html" });
        res.end(
          [
            "<!doctype html>",
            "<html><body>",
            "<script>window.__COMPONENT_PREVIEW_PLUGIN__={};</script>",
            '<div id="preview-target" class="fixture-card" data-cp-file="App.tsx" data-cp-line="2" data-cp-col="10" style="padding:20px;border:1px solid #ccc">hover target)</div>',
            "</body></html>",
          ].join(""),
        );
        return;
      }
      if (req.url.startsWith("/react_jsx-dev-runtime.js")) {
        res.writeHead(200, { "content-type": "application/javascript" });
        res.end("export {};");
        return;
      }
      res.writeHead(404);
      res.end("not found");
    });

    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => resolve());
    });

    try {
      const address = server.address();
      assert.ok(address && typeof address === "object");
      const url = `http://127.0.0.1:${address.port}`;

      const config = vscode.workspace.getConfiguration("component-preview", vscode.Uri.file(filePath));
      await config.update("devServerUrl", url, vscode.ConfigurationTarget.Global);

      const hovers = await openFileAndHover(filePath, new vscode.Position(1, 10));
      const text = hovers.map(hoverToString).join("\n\n");

      assert.ok(
        text.includes("data:image/jpeg;base64,") || text.includes("data:image/png;base64,"),
        `Expected image hover content, got:\n${text}`,
      );

      const imagePath = await writeFirstEmbeddedImageFromHoverMarkdown(text);
      assert.ok(imagePath, "Expected a base64 image in hover markdown");
      console.log(`[hover-demo-image] ${imagePath}`);

      const metadata = readAttachCommandMetadata(text);
      assert.ok(metadata, `Expected hover command metadata, got:\n${text}`);
      assert.strictEqual(metadata.adapter, "vite-plugin");
      assert.strictEqual(metadata.element.tag, "div");
      assert.strictEqual(metadata.element.id, "preview-target");
      assert.strictEqual(metadata.element.className, "fixture-card");
      assert.strictEqual(metadata.element.text, "hover target)");
      assert.strictEqual(metadata.source.file, "App.tsx");
      assert.strictEqual(metadata.source.line, 2);
      assert.strictEqual(metadata.source.column, 10);
      assert.strictEqual(metadata.source.origin, "data-cp");
    } finally {
      const config = vscode.workspace.getConfiguration("component-preview", vscode.Uri.file(filePath));
      await config.update("devServerUrl", "", vscode.ConfigurationTarget.Global);
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  test("resolves component invocation hover to the component definition source", async function () {
    this.timeout(30_000);

    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "cp-hover-component-def-"));
    const appPath = await writeFixtureFile(
      tmp,
      "App.tsx",
      [
        "import { HeroSection } from './components/HeroSection';",
        "import { MetricsGrid } from './components/MetricsGrid';",
        "",
        "export function App() {",
        "  return (",
        "    <main>",
        "      <HeroSection />",
        "      <MetricsGrid />",
        "    </main>",
        "  );",
        "}",
      ].join("\n"),
    );
    await writeFixtureFile(
      tmp,
      "components/HeroSection.tsx",
      [
        "export function HeroSection() {",
        "  return <section>hero section</section>;",
        "}",
      ].join("\n"),
    );
    await writeFixtureFile(
      tmp,
      "components/MetricsGrid.tsx",
      [
        "export function MetricsGrid() {",
        "  return <section>metrics grid</section>;",
        "}",
      ].join("\n"),
    );

    const server = http.createServer((req, res) => {
      if (!req.url || req.url === "/") {
        res.writeHead(200, { "content-type": "text/html" });
        res.end(
          [
            "<!doctype html>",
            "<html><body>",
            "<script>window.__COMPONENT_PREVIEW_PLUGIN__={};</script>",
            '<main data-cp-file="App.tsx" data-cp-line="6" data-cp-col="5">app shell</main>',
            '<section id="hero-target" data-cp-file="components/HeroSection.tsx" data-cp-line="2" data-cp-col="10">hero section</section>',
            '<section id="metrics-target" data-cp-file="components/MetricsGrid.tsx" data-cp-line="2" data-cp-col="10">metrics grid</section>',
            "</body></html>",
          ].join(""),
        );
        return;
      }
      if (req.url.startsWith("/react_jsx-dev-runtime.js")) {
        res.writeHead(200, { "content-type": "application/javascript" });
        res.end("export {};");
        return;
      }
      res.writeHead(404);
      res.end("not found");
    });

    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => resolve());
    });

    try {
      const address = server.address();
      assert.ok(address && typeof address === "object");
      const url = `http://127.0.0.1:${address.port}`;
      const config = vscode.workspace.getConfiguration("component-preview", vscode.Uri.file(appPath));
      await config.update("devServerUrl", url, vscode.ConfigurationTarget.Global);

      const hovers = await openFileAndHover(appPath, new vscode.Position(6, 10));
      const text = hovers.map(hoverToString).join("\n\n");
      const metadata = readAttachCommandMetadata(text);

      assert.ok(metadata, `Expected hover command metadata, got:\n${text}`);
      assert.strictEqual(metadata.source.file, "components/HeroSection.tsx");
      assert.strictEqual(metadata.element.id, "hero-target");
      assert.strictEqual(metadata.source.line, 2);
      assert.strictEqual(metadata.source.origin, "data-cp");
    } finally {
      const config = vscode.workspace.getConfiguration("component-preview", vscode.Uri.file(appPath));
      await config.update("devServerUrl", "", vscode.ConfigurationTarget.Global);
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
