import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { disposeDevPage } from "./devServerRenderer";
import { HtmlHoverProvider, PLUGIN_SETUP_COMMAND } from "./hoverProvider";
import { createImageStore } from "./imageStore";
import { initLogger, error as logError } from "./logger";
import { compressImageFile, disposeRenderer } from "./renderer";

const MAX_PERSISTED_PREVIEW_BYTES = 200 * 1024 * 1024; // 200 MB
const MAX_PERSISTED_PREVIEW_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  initLogger();
  const storageRoot = context.globalStorageUri.fsPath;
  const previewDir = path.join(storageRoot, "previews");
  const attachedDir = path.join(storageRoot, "attached");

  await Promise.all([
    fs.promises.mkdir(previewDir, { recursive: true }),
    fs.promises.mkdir(attachedDir, { recursive: true }),
  ]);

  await prunePersistedPreviews(attachedDir).catch((err) => {
    logError("initial persisted preview prune failed:", err);
  });

  const imageStore = await createImageStore(storageRoot);
  const provider = new HtmlHoverProvider(
    previewDir,
    imageStore,
    context.globalState,
    path.join(context.extensionPath, "images", "ComponentPreview_Icon-sm.png"),
  );

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

  const copyPreviewPathCommand = vscode.commands.registerCommand(
    "component-preview.copyPreviewPath",
    async (imagePath: string) => {
      if (!imagePath) {
        await vscode.window.showWarningMessage("No preview image path available to copy.");
        return;
      }

      let pathToCopy = imagePath;

      // Preview captures are ephemeral and can be wiped on extension dispose/reload.
      // Persist copied preview paths by snapshotting into attached/ first.
      if (imagePath.startsWith(`${previewDir}${path.sep}`)) {
        try {
          const ext = path.extname(imagePath) || ".jpeg";
          const persistentPath = path.join(attachedDir, `${randomUUID()}${ext}`);
          await fs.promises.copyFile(imagePath, persistentPath);
          pathToCopy = persistentPath;
        } catch (err) {
          logError("copy preview path persist failed:", err);
          await vscode.window.showWarningMessage(
            "Could not persist preview image; copied temporary path instead.",
          );
        }
      }

      await prunePersistedPreviews(attachedDir).catch((err) => {
        logError("post-copy persisted preview prune failed:", err);
      });

      await vscode.env.clipboard.writeText(pathToCopy);
      await vscode.window.showInformationMessage("Copied preview image path to clipboard.");
    },
  );

  const openStoredPreviewsCommand = vscode.commands.registerCommand(
    "component-preview.openStoredPreviewsFolder",
    async () => {
      await vscode.env.openExternal(vscode.Uri.file(attachedDir));
    },
  );

  const clearStoredPreviewsCommand = vscode.commands.registerCommand(
    "component-preview.clearStoredPreviews",
    async () => {
      const files = await listImageFiles(attachedDir);
      if (files.length === 0) {
        await vscode.window.showInformationMessage("No stored preview images to clear.");
        return;
      }

      const confirm = await vscode.window.showWarningMessage(
        `Delete ${files.length} stored preview image${files.length === 1 ? "" : "s"}?`,
        { modal: true },
        "Delete",
      );
      if (confirm !== "Delete") {
        return;
      }

      await Promise.all(files.map((f) => fs.promises.unlink(f.path).catch(() => undefined)));
      await vscode.window.showInformationMessage("Stored preview images cleared.");
    },
  );

  const pluginSetupCommand = vscode.commands.registerCommand(PLUGIN_SETUP_COMMAND, async () => {
    await vscode.env.openExternal(
      vscode.Uri.parse("https://www.npmjs.com/package/vite-plugin-component-preview"),
    );
  });

  context.subscriptions.push(
    hoverDisposable,
    attachCommand,
    copyPreviewPathCommand,
    openStoredPreviewsCommand,
    clearStoredPreviewsCommand,
    pluginSetupCommand,
    {
      dispose: () => {
        disposeDevPage();
        disposeRenderer().catch(logError);
        // Only clean up ephemeral previews. Attached images are permanent user data.
        fs.promises.rm(previewDir, { recursive: true, force: true }).catch(logError);
      },
    },
  );
}

interface StoredImageFile {
  path: string;
  size: number;
  mtimeMs: number;
}

function isImageExt(filePath: string): boolean {
  return /\.(png|jpe?g|webp)$/i.test(filePath);
}

async function listImageFiles(dir: string): Promise<StoredImageFile[]> {
  let names: string[] = [];
  try {
    names = await fs.promises.readdir(dir);
  } catch {
    return [];
  }

  const files = await Promise.all(
    names.map(async (name) => {
      const fullPath = path.join(dir, name);
      if (!isImageExt(fullPath)) {
        return null;
      }
      try {
        const stat = await fs.promises.stat(fullPath);
        if (!stat.isFile()) {
          return null;
        }
        return { path: fullPath, size: stat.size, mtimeMs: stat.mtimeMs } as StoredImageFile;
      } catch {
        return null;
      }
    }),
  );

  return files.filter((f): f is StoredImageFile => f !== null);
}

async function prunePersistedPreviews(attachedDir: string): Promise<void> {
  const now = Date.now();
  const files = await listImageFiles(attachedDir);

  // First, delete anything older than max age.
  const freshFiles: StoredImageFile[] = [];
  for (const file of files) {
    if (now - file.mtimeMs > MAX_PERSISTED_PREVIEW_AGE_MS) {
      await fs.promises.unlink(file.path).catch(() => undefined);
      continue;
    }
    freshFiles.push(file);
  }

  // Then enforce total-size cap by deleting oldest first.
  let totalSize = freshFiles.reduce((sum, file) => sum + file.size, 0);
  if (totalSize <= MAX_PERSISTED_PREVIEW_BYTES) {
    return;
  }

  const oldestFirst = [...freshFiles].sort((a, b) => a.mtimeMs - b.mtimeMs);
  for (const file of oldestFirst) {
    await fs.promises.unlink(file.path).catch(() => undefined);
    totalSize -= file.size;
    if (totalSize <= MAX_PERSISTED_PREVIEW_BYTES) {
      break;
    }
  }
}

export function deactivate(): void {}
