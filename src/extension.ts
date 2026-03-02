import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { HtmlHoverProvider } from "./hoverProvider";
import { disposeRenderer } from "./renderer";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const previewDir = path.join(context.globalStorageUri.fsPath, "previews");
  await fs.promises.mkdir(previewDir, { recursive: true });

  const provider = new HtmlHoverProvider(previewDir);
  const hoverDisposable = vscode.languages.registerHoverProvider(
    { language: "html", scheme: "file" },
    provider,
  );

  context.subscriptions.push(hoverDisposable, {
    dispose: () => {
      disposeRenderer().catch(console.error);
      fs.promises.rm(previewDir, { recursive: true, force: true }).catch(console.error);
    },
  });
}

export function deactivate(): void {}
