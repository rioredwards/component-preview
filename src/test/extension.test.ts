import * as assert from "assert";
import * as fs from "fs/promises";
import * as http from "http";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";

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

suite("Extension Test Suite", () => {
  test("shows a no-server diagnostic hover when no matching dev server is available", async () => {
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

    const hovers = await openFileAndHover(filePath, new vscode.Position(1, 10));
    const text = hovers.map(hoverToString).join("\n\n");

    assert.ok(
      text.includes("No matching dev server was detected for this workspace."),
      `Expected no-server hover text, got:\n${text}`,
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
            "<script>window.__COMPONENT_PREVIEW_PLUGIN__={version:'0.1.0'};</script>",
            '<div data-cp-file="App.tsx" data-cp-line="2" data-cp-col="10" style="padding:20px;border:1px solid #ccc">hover target</div>',
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
    } finally {
      const config = vscode.workspace.getConfiguration("component-preview", vscode.Uri.file(filePath));
      await config.update("devServerUrl", "", vscode.ConfigurationTarget.Global);
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
