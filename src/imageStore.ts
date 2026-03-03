import * as fs from "fs";
import * as fsp from "fs/promises";
import * as path from "path";

/** Maps cache keys (uri\x00elementId) to absolute paths of attached images. */
export interface ImageStore {
  get(key: string): string | undefined;
  set(key: string, imagePath: string): Promise<void>;
}

export async function createImageStore(storageDir: string): Promise<ImageStore> {
  const storeFile = path.join(storageDir, "image-store.json");
  let data: Record<string, string> = {};

  try {
    data = JSON.parse(await fsp.readFile(storeFile, "utf8")) as Record<string, string>;
  } catch {
    // File doesn't exist yet — start fresh
  }

  return {
    get(key) {
      const p = data[key];
      // Guard against stale entries where the image file was deleted
      if (p && fs.existsSync(p)) {
        return p;
      }
      return undefined;
    },
    async set(key, imagePath) {
      data[key] = imagePath;
      await fsp.writeFile(storeFile, JSON.stringify(data, null, 2), "utf8");
    },
  };
}
