import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { disposeDevPage } from "./devServerRenderer";
import { HtmlHoverProvider, PLUGIN_SETUP_COMMAND } from "./hoverProvider";
import { createImageStore } from "./imageStore";
import { error as logError, initLogger } from "./logger";
import { compressImageFile, disposeRenderer } from "./renderer";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  initLogger();
  const storageRoot = context.globalStorageUri.fsPath;
  const previewDir = path.join(storageRoot, "previews");
  const attachedDir = path.join(storageRoot, "attached");

  await Promise.all([
    fs.promises.mkdir(previewDir, { recursive: true }),
    fs.promises.mkdir(attachedDir, { recursive: true }),
  ]);

  const imageStore = await createImageStore(storageRoot);
  const provider = new HtmlHoverProvider(previewDir, imageStore, context.globalState);

  const hoverDisposable = vscode.languages.registerHoverProvider(
    [
      { language: "html", scheme: "file" },
      { language: "typescriptreact", scheme: "file" },
      { language: "javascriptreact", scheme: "file" },
      { language: "vue", scheme: "file" },
      { language: "svelte", scheme: "file" },
    ],
    provider,
  );

  const attachCommand = vscode.commands.registerCommand(
    "component-preview.attachImage",
    async (elementId: string, documentUri: string) => {
      const files = await vscode.window.showOpenDialog({
        canSelectMany: false,
        filters: { Images: ["png", "jpg", "jpeg", "webp"] },
        title: "Attach preview image",
      });
      if (!files || files.length === 0) {
        return;
      }

      const src = files[0].fsPath;
      const dest = path.join(attachedDir, `${randomUUID()}.jpeg`);

      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: "Processing image…" },
        () => compressImageFile(src, dest),
      );

      const cacheKey = `${documentUri}\x00${elementId}`;
      await imageStore.set(cacheKey, dest);

      vscode.window.showInformationMessage("Preview image attached! Hover again to see it.");
    },
  );

  const pluginSetupCommand = vscode.commands.registerCommand(
    PLUGIN_SETUP_COMMAND,
    async () => {
      await vscode.env.openExternal(
        vscode.Uri.parse("https://www.npmjs.com/package/vite-plugin-component-preview"),
      );
    },
  );

  context.subscriptions.push(hoverDisposable, attachCommand, pluginSetupCommand, {
    dispose: () => {
      disposeDevPage();
      disposeRenderer().catch(logError);
      // Only clean up ephemeral previews. Attached images are permanent user data.
      fs.promises.rm(previewDir, { recursive: true, force: true }).catch(logError);
    },
  });
}

export function deactivate(): void {}
